import { plantCosts, plantingSlots, growthDuration, expansionCost, parcelLimit, hexDirections, hexKey, expansionTargets, treeKind, canPlantTree, treeBiomes, moveTargets, connectedHexKeys } from './garden-layout.js';
import { gardenerCost } from './gardener-logic.js';

const storageKey = 'seed-garden-resources';
export const stoneLimit = 10000;
const validSeed = (seed) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const validTree = (tree) => tree && validSeed(tree.seed) && Number.isSafeInteger(tree.startedAt) && tree.startedAt > 0
  && Number.isFinite(tree.x) && Number.isFinite(tree.z) && Math.hypot(tree.x, tree.z) <= 0.55;
const copyTree = (tree) => tree ? { x: tree.x, z: tree.z, seed: tree.seed, startedAt: tree.startedAt } : null;
const copyParcel = (parcel) => ({ ...parcel, plants: parcel.plants.map((plant) => ({ ...plant })), tree: copyTree(parcel.tree) });
const emptyParcel = ({ q = 0, r = 0 } = {}) => ({ q, r, plants: [], tree: null, biome: 'meadow' });
const validPosition = (position) => position && Number.isInteger(position.q) && Number.isInteger(position.r)
  && Math.max(Math.abs(position.q), Math.abs(position.r), Math.abs(position.q + position.r)) < parcelLimit;

export function createResources(storage) {
  let stone = 0;
  let fruit = 0;
  let parcels = [emptyParcel()];
  function readPlants(savedPlants) {
    const occupied = new Set();
    if (!Array.isArray(savedPlants)) return [];
    return savedPlants.filter((plant) => {
      if (!plant || !Object.hasOwn(plantCosts, plant.type) || !validSeed(plant.seed)
        || !Number.isInteger(plant.slot) || plant.slot < 0 || plant.slot >= plantingSlots.length || occupied.has(plant.slot)) return false;
      occupied.add(plant.slot);
      return true;
    }).map(({ type, seed, slot }) => ({ type, seed, slot }));
  }
  function readParcel(record, id, plotCount = id + 1) {
    const tree = validTree(record?.tree) ? copyTree(record.tree) : null;
    // Older saves inferred the species from plot order; newer saves remember the player's choice.
    const type = canPlantTree(record.treeType, id, plotCount) ? record.treeType : treeKind(id);
    return { q: record.q, r: record.r, plants: readPlants(record.plants), tree,
      ...(record.gardener === true ? { gardener: true } : {}),
      ...(tree ? { treeType: type } : {}),
      biome: tree || record.biome === treeBiomes[type] ? treeBiomes[type] : 'meadow' };
  }
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (Number.isSafeInteger(saved?.stone) && saved.stone >= 0) stone = Math.min(saved.stone, stoneLimit);
    if (Number.isSafeInteger(saved?.fruit) && saved.fruit >= 0) fruit = saved.fruit;
    if (Array.isArray(saved?.parcels)) {
      const restored = [];
      const records = saved.parcels.slice(0, parcelLimit);
      // Moved plots need not be adjacent to an earlier plot in creation order.
      const connected = saved.version === 3 ? connectedHexKeys(records.filter(validPosition)) : null;
      for (const record of records) {
        if (!validPosition(record)) continue;
        if (restored.length === 0) {
          if (record.q !== 0 || record.r !== 0) continue;
        } else if (connected ? !connected.has(hexKey(record)) || restored.some((parcel) => hexKey(parcel) === hexKey(record))
          : !expansionTargets(restored).some((target) => hexKey(target) === hexKey(record))) continue;
        restored.push(readParcel(record, restored.length, Math.min(saved.parcels.length, parcelLimit)));
      }
      if (restored.length) parcels = restored;
    } else {
      // Migrate the original single-plot and two-plot saves without changing tree seeds or times.
      parcels[0] = readParcel({ ...saved, q: 0, r: 0 }, 0);
      const direction = saved?.second?.direction;
      if (Number.isInteger(direction) && hexDirections[direction]) {
        parcels.push(readParcel({ ...saved.second, ...hexDirections[direction] }, 1));
      }
    }
    // The original single gardener always belonged to the first plot.
    if (saved?.gardener === true) parcels[0].gardener = true;
  } catch { /* Storage may be unavailable or contain invalid data. */ }

  function save() {
    // Spending and all parcels are written as one snapshot.
    try { storage.setItem(storageKey, JSON.stringify({ version: 3, stone, fruit, parcels })); } catch { /* Keep the garden for this visit. */ }
  }
  const parcelAt = (id) => Number.isInteger(id) && id >= 0 ? parcels[id] : null;
  function expansionProgress(now = Date.now()) {
    const parcelId = parcels.length - 1;
    const parcel = parcels[parcelId];
    const counts = { bush: 0, mushroom: 0, flower: 0 };
    parcel.plants.forEach((plant) => { counts[plant.type] += 1; });
    return { parcelId, stone, ...counts, tree: Boolean(parcel.tree && now - parcel.tree.startedAt >= growthDuration) };
  }
  function canExpand(now = Date.now()) {
    const progress = expansionProgress(now);
    return parcels.length < parcelLimit && progress.stone >= expansionCost && progress.tree
      && progress.bush >= 3 && progress.mushroom >= 6 && progress.flower >= 8;
  }

  return {
    get stone() { return stone; },
    get fruit() { return fruit; },
    hasGardener(id = 0) { return parcelAt(id)?.gardener === true; },
    buyGardener(id = 0) {
      const parcel = parcelAt(id);
      if (!parcel || parcel.gardener || stone < gardenerCost) return false;
      stone -= gardenerCost;
      parcel.gardener = true;
      save();
      return true;
    },
    transferGardener(fromId, toId) {
      const from = parcelAt(fromId);
      const to = parcelAt(toId);
      if (!from?.gardener || !to || to.gardener || fromId === toId) return false;
      delete from.gardener;
      to.gardener = true;
      save();
      return true;
    },
    collectFruit(id = 0) {
      const parcel = parcelAt(id);
      const tree = parcel?.tree;
      if (!parcel?.gardener || !tree || Date.now() - tree.startedAt < growthDuration || fruit >= Number.MAX_SAFE_INTEGER) return false;
      fruit += 1;
      save();
      return true;
    },
    get plants() { return parcels[0].plants.map((plant) => ({ ...plant })); },
    get tree() { return copyTree(parcels[0].tree); },
    get parcels() { return parcels.map(copyParcel); },
    parcel(id = 0) { const parcel = parcelAt(id); return parcel ? copyParcel(parcel) : null; },
    expansionProgress,
    canExpand,
    expansionTargets() { return parcels.length < parcelLimit ? expansionTargets(parcels) : []; },
    moveTargets(id) { return moveTargets(parcels, id); },
    moveParcel(id, target) {
      if (!validPosition(target) || !moveTargets(parcels, id).some((position) => hexKey(position) === hexKey(target))) return false;
      parcels[id].q = target.q;
      parcels[id].r = target.r;
      save();
      return true;
    },
    newGame() {
      stone = 0;
      fruit = 0;
      parcels = [emptyParcel()];
      save();
    },
    expand(target, now = Date.now()) {
      if (!validPosition(target) || !canExpand(now)
        || !expansionTargets(parcels).some((position) => hexKey(position) === hexKey(target))) return false;
      stone -= expansionCost;
      parcels.push(emptyParcel(target));
      save();
      return true;
    },
    mineStone() {
      if (stone < stoneLimit) stone += 1;
      save();
      return stone;
    },
    plant(type, slot, seed, parcelId = 0) {
      const parcel = parcelAt(parcelId);
      if (!parcel || !Object.hasOwn(plantCosts, type) || !validSeed(seed) || !Number.isInteger(slot)
        || slot < 0 || slot >= plantingSlots.length || parcel.plants.some((plant) => plant.slot === slot)
        || stone < plantCosts[type]) return false;
      stone -= plantCosts[type];
      parcel.plants.push({ type, slot, seed });
      save();
      return true;
    },
    removePlant(slot, parcelId = 0) {
      const parcel = parcelAt(parcelId);
      if (!parcel || !Number.isInteger(slot)) return false;
      const index = parcel.plants.findIndex((plant) => plant.slot === slot);
      if (index === -1) return false;
      parcel.plants.splice(index, 1);
      save();
      return true;
    },
    setTree(value, parcelId = 0, type = treeKind(parcelId)) {
      const parcel = parcelAt(parcelId);
      if (!parcel || !validTree(value) || parcel.tree || !canPlantTree(type, parcelId, parcels.length)) return false;
      parcel.tree = copyTree(value);
      parcel.treeType = type;
      parcel.biome = treeBiomes[type];
      save();
      return true;
    },
  };
}
