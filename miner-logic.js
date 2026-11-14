import { plantingSlots } from './garden-layout.js';

export const minerCost = 100;
export const miningDuration = 3000;

export function minerPosition(quarry) {
  let best;
  let bestClearance = -Infinity;
  for (const distance of [0.48, 0.55, 0.62]) {
    for (let step = 0; step < 72; step++) {
      const angle = step * Math.PI / 36;
      const x = quarry.x + Math.cos(angle) * distance;
      const z = quarry.z + Math.sin(angle) * distance;
      let clearance = Math.min(Math.hypot(x, z) - 1.65, distance - 0.2);
      for (let side = 0; side < 6; side++) {
        const heading = side * Math.PI / 3;
        clearance = Math.min(clearance, 2.67 * Math.cos(Math.PI / 6) - x * Math.cos(heading) - z * Math.sin(heading));
      }
      for (const slot of plantingSlots) clearance = Math.min(clearance, Math.hypot(x - slot.x, z - slot.z) - 0.26);
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = { x, z };
      }
    }
  }
  return best;
}

export function createMiningCycle(strike) {
  let elapsed = 0;
  return {
    get elapsed() { return elapsed; },
    advance(delta, active) {
      if (!active || !Number.isFinite(delta) || delta <= 0) return false;
      elapsed += Math.min(delta, 100);
      if (elapsed < miningDuration) return false;
      elapsed -= miningDuration;
      strike();
      return true;
    },
  };
}
