export const gardenerCost = 100;
export const gatheringDuration = 3000;
export const pickupTime = 2400;

// The inner and outer planting rings leave this corridor free. Stay on the
// opposite arc from the quarry, and retrace it rather than crossing the tree.
export function gardenerRoute(quarry) {
  const angle = Math.atan2(quarry.z, quarry.x);
  return Array.from({ length: 9 }, (_, index) => {
    const heading = angle + 1 + index * (Math.PI * 2 - 2) / 8;
    return { x: Math.cos(heading) * 1.48, z: Math.sin(heading) * 1.48 };
  });
}

export function createGatheringCycle(collect) {
  let elapsed = 0;
  let picked = false;
  return {
    get elapsed() { return elapsed; },
    get picked() { return picked; },
    advance(delta, active) {
      if (!active || !Number.isFinite(delta) || delta <= 0) return false;
      // Never catch up a suspended tab or a stalled animation loop.
      elapsed += Math.min(delta, 100);
      if (!picked && elapsed >= pickupTime) {
        picked = true;
        collect();
      }
      if (elapsed < gatheringDuration) return false;
      elapsed -= gatheringDuration;
      picked = false;
      return true;
    },
  };
}
