export const plantCosts = Object.freeze({ flower: 1, mushroom: 2, bush: 3 });
export const growthDuration = 26000;
export const expansionCost = 500;
export const neighborOffsets = Object.freeze(Array.from({ length: 6 }, (_, direction) => {
  const distance = 2 * 2.67 * Math.cos(Math.PI / 6);
  return Object.freeze({ x: Math.cos(direction * Math.PI / 3) * distance, z: Math.sin(direction * Math.PI / 3) * distance });
}));
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
