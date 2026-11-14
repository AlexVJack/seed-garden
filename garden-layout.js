export const plantCosts = Object.freeze({ flower: 1, mushroom: 2, bush: 3 });
export const growthDuration = 26000;
export const expansionCost = 150;
export const parcelLimit = 36;
export const hexDirections = Object.freeze([
  { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
  { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
].map(Object.freeze));
export const hexKey = ({ q, r }) => `${q},${r}`;
// Keep terrain stable across garden limit changes, including existing saves.
export const terrainSeed = ({ q, r }) => {
  const index = Math.abs(q) < 12 && Math.abs(r) < 12
    ? q + 12 + (r + 12) * 25
    : 625 + q + 36 + (r + 36) * 73;
  return (Math.imul(index, 0x9e3779b1) ^ 42) >>> 0;
};
export const treeKind = (id) => id % 2 === 0 ? 'apple' : 'pine';
export const treeBiomes = Object.freeze({ apple: 'meadow', pine: 'conifer', baobab: 'savanna', palm: 'desert', sakura: 'blossom', darkOak: 'darkForest', maple: 'autumn' });
export const treeUnlockPlots = Object.freeze({ apple: 1, pine: 2, baobab: 3, palm: 4, sakura: 5, darkOak: 6, maple: 7 });
export const canPlantTree = (type, id, plotCount = id + 1) => Object.hasOwn(treeBiomes, type)
  && plotCount >= treeUnlockPlots[type] && (id >= 1 || type === 'apple');
export function parcelPosition({ q, r }) {
  const distance = 2 * 2.67 * Math.cos(Math.PI / 6);
  return { x: distance * (q + r / 2), z: distance * Math.sqrt(3) / 2 * r };
}
export const neighborOffsets = Object.freeze(hexDirections.map((direction) => Object.freeze(parcelPosition(direction))));
export function expansionTargets(parcels) {
  const occupied = new Set(parcels.map(hexKey));
  const targets = new Map();
  parcels.forEach(({ q, r }) => hexDirections.forEach((direction) => {
    const target = { q: q + direction.q, r: r + direction.r };
    if (!occupied.has(hexKey(target))) targets.set(hexKey(target), target);
  }));
  return [...targets.values()];
}
const quarryAngle = Math.atan2(1.15, 1.55);

// Leave an opening in the outer ring for the quarry and space around the tree.
export const plantingSlots = Object.freeze([
  ...Array.from({ length: 6 }, (_, i) => {
    const angle = 0.1 + i * Math.PI / 3;
    return { x: Math.cos(angle) * 1.04, z: Math.sin(angle) * 1.04 };
  }),
  ...Array.from({ length: 18 }, (_, i) => {
    const angle = quarryAngle + 0.38 + i * (Math.PI * 2 - 0.76) / 17;
    return { x: Math.cos(angle) * 1.9, z: Math.sin(angle) * 1.9 };
  }),
].map(Object.freeze));
