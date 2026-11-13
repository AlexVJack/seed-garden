import { createRandom } from './random.js';
import { plantingSlots, terrainSeed } from './garden-layout.js';

export const quarryRadius = 0.2;
// Compute safe candidates once. Picking a sector first avoids crowding every
// quarry into the large gap originally reserved on one side of the island.
const sectors = Array.from({ length: 6 }, () => []);
for (let ix = -50; ix <= 50; ix++) {
  for (let iz = -50; iz <= 50; iz++) {
    const x = ix * 0.05;
    const z = iz * 0.05;
    if (Math.hypot(x, z) < 1.65
      || plantingSlots.some((slot) => Math.hypot(slot.x - x, slot.z - z) < quarryRadius + 0.26)) continue;
    let inside = true;
    for (let side = 0; side < 6; side++) {
      const angle = side * Math.PI / 3;
      if (x * Math.cos(angle) + z * Math.sin(angle) > 2.67 * Math.cos(Math.PI / 6) - quarryRadius - 0.02) inside = false;
    }
    if (!inside) continue;
    const sector = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 3)) % 6;
    sectors[sector].push({ x, z });
  }
}
const availableSectors = sectors.filter((sector) => sector.length);

export function quarryLayout(position) {
  const random = createRandom(terrainSeed(position) ^ 0x51ed270b);
  const sector = availableSectors[Math.floor(random() * availableSectors.length)];
  const { x, z } = sector[Math.floor(random() * sector.length)];
  return { x, z, shapeSeed: Math.floor(random() * 0x100000000),
    width: 0.18 + random() * 0.02, depth: 0.18 + random() * 0.02,
    height: 0.4 + random() * 0.15, rotation: random() * Math.PI * 2 };
}
