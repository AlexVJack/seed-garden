import { plantCosts, plantingSlots, growthDuration, expansionCost, neighborOffsets } from './garden-layout.js';

const storageKey = 'seed-garden-resources';
export const stoneLimit = 10000;
const validSeed = (seed) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const validTree = (tree) => tree && validSeed(tree.seed) && Number.isSafeInteger(tree.startedAt) && tree.startedAt > 0
  && Number.isFinite(tree.x) && Number.isFinite(tree.z) && Math.hypot(tree.x, tree.z) <= 0.55;

export function createResources(storage) {
  let stone = 0;
  let plants = [];
  let tree = null;
  let second = null;
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
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (Number.isSafeInteger(saved?.stone) && saved.stone >= 0) stone = Math.min(saved.stone, stoneLimit);
    plants = readPlants(saved?.plants);
    if (validTree(saved?.tree)) tree = { ...saved.tree };
    if (Number.isInteger(saved?.second?.direction) && neighborOffsets[saved.second.direction]) {
      second = { direction: saved.second.direction, plants: readPlants(saved.second.plants),
        tree: validTree(saved.second.tree) ? { ...saved.second.tree } : null,
        biome: saved.second.biome === 'conifer' || validTree(saved.second.tree) ? 'conifer' : 'meadow' };
    }
  } catch { /* Storage may be unavailable or contain invalid data. */ }

  function save() {
    // One snapshot keeps spending and planting together, including existing stone saves.
    try { storage.setItem(storageKey, JSON.stringify({ stone, plants, tree, second })); } catch { /* Keep the garden for this visit. */ }
  }

  function expansionProgress(now = Date.now()) {
    const counts = { bush: 0, mushroom: 0, flower: 0 };
    plants.forEach((plant) => { counts[plant.type] += 1; });
    return { stone, ...counts, tree: Boolean(tree && now - tree.startedAt >= growthDuration) };
  }
  function canExpand(now = Date.now()) {
    const progress = expansionProgress(now);
    return !second && progress.stone >= expansionCost && progress.tree
      && progress.bush >= 3 && progress.mushroom >= 6 && progress.flower >= 8;
  }

  return {
    get stone() { return stone; },
    get plants() { return plants.map((plant) => ({ ...plant })); },
    get tree() { return tree ? { ...tree } : null; },
    get second() { return second ? { ...second, plants: second.plants.map((plant) => ({ ...plant })), tree: second.tree ? { ...second.tree } : null } : null; },
    parcel(id = 0) {
      if (id === 0) return { plants: plants.map((plant) => ({ ...plant })), tree: tree ? { ...tree } : null, biome: 'meadow' };
      if (id === 1 && second) return { ...second, plants: second.plants.map((plant) => ({ ...plant })), tree: second.tree ? { ...second.tree } : null };
      return null;
    },
    expansionProgress,
    canExpand,
    expand(direction, now = Date.now()) {
      if (!Number.isInteger(direction) || !neighborOffsets[direction] || !canExpand(now)) return false;
      stone -= expansionCost;
      second = { direction, plants: [], tree: null, biome: 'meadow' };
      save();
      return true;
    },
    mineStone() {
      if (stone < stoneLimit) stone += 1;
      save();
      return stone;
    },
    plant(type, slot, seed, parcelId = 0) {
      if (parcelId !== 0 && (parcelId !== 1 || !second)) return false;
      const targetPlants = parcelId === 0 ? plants : second.plants;
      if (!Object.hasOwn(plantCosts, type) || !validSeed(seed) || !Number.isInteger(slot)
        || slot < 0 || slot >= plantingSlots.length || targetPlants.some((plant) => plant.slot === slot)
        || stone < plantCosts[type]) return false;
      stone -= plantCosts[type];
      targetPlants.push({ type, slot, seed });
      save();
      return true;
    },
    setTree(value, parcelId = 0) {
      if (parcelId !== 0 && (parcelId !== 1 || !second)) return false;
      if (value !== null && !validTree(value)) return false;
      if (parcelId === 0) tree = value ? { ...value } : null;
      else {
        second.tree = value ? { ...value } : null;
        if (value) second.biome = 'conifer';
      }
      save();
      return true;
    },
  };
}
