import { plantCosts, plantingSlots } from './garden-layout.js';

const storageKey = 'seed-garden-resources';
const validSeed = (seed) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const validTree = (tree) => tree && validSeed(tree.seed) && Number.isSafeInteger(tree.startedAt) && tree.startedAt > 0
  && Number.isFinite(tree.x) && Number.isFinite(tree.z) && Math.hypot(tree.x, tree.z) <= 0.55;

export function createResources(storage) {
  let stone = 0;
  let plants = [];
  let tree = null;
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (Number.isSafeInteger(saved?.stone) && saved.stone >= 0) stone = saved.stone;
    const occupied = new Set();
    if (Array.isArray(saved?.plants)) {
      plants = saved.plants.filter((plant) => {
        if (!plant || !Object.hasOwn(plantCosts, plant.type) || !validSeed(plant.seed)
          || !Number.isInteger(plant.slot) || plant.slot < 0 || plant.slot >= plantingSlots.length || occupied.has(plant.slot)) return false;
        occupied.add(plant.slot);
        return true;
      }).map(({ type, seed, slot }) => ({ type, seed, slot }));
    }
    if (validTree(saved?.tree)) tree = { ...saved.tree };
  } catch { /* Storage may be unavailable or contain invalid data. */ }

  function save() {
    // One snapshot keeps spending and planting together, including existing stone saves.
    try { storage.setItem(storageKey, JSON.stringify({ stone, plants, tree })); } catch { /* Keep the garden for this visit. */ }
  }

  return {
    get stone() { return stone; },
    get plants() { return plants.map((plant) => ({ ...plant })); },
    get tree() { return tree ? { ...tree } : null; },
    mineStone() {
      if (stone < Number.MAX_SAFE_INTEGER) stone += 1;
      save();
      return stone;
    },
    plant(type, slot, seed) {
      if (!Object.hasOwn(plantCosts, type) || !validSeed(seed) || !Number.isInteger(slot)
        || slot < 0 || slot >= plantingSlots.length || plants.some((plant) => plant.slot === slot)
        || stone < plantCosts[type]) return false;
      stone -= plantCosts[type];
      plants.push({ type, slot, seed });
      save();
      return true;
    },
    setTree(value) {
      if (value !== null && !validTree(value)) return false;
      tree = value ? { ...value } : null;
      save();
      return true;
    },
  };
}
