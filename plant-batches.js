import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePlant } from './plants.js';
import { plantingSlots } from './garden-layout.js';

// Materials and source geometries belong to plants.js and are shared by all plots.
// Only the transformed copies and merged geometries belong to this batch.
export function makePlantBatch(plants, biome, groundY = 0) {
  const group = new THREE.Group();
  const batches = new Map();
  try {
    for (const plant of plants) {
      const source = makePlant(plant.type, plant.seed, biome);
      const slot = plantingSlots[plant.slot];
      source.position.set(slot.x, groundY, slot.z);
      source.updateMatrixWorld(true);
      source.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        // Icosahedra are non-indexed, unlike the other shared primitives.
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
        let batch = batches.get(mesh.material);
        if (!batch) {
          batch = { geometries: [], ranges: [], triangles: 0 };
          batches.set(mesh.material, batch);
        }
        batch.geometries.push(geometry);
        batch.triangles += geometry.index.count / 3;
        batch.ranges.push({ end: batch.triangles, slot: plant.slot });
      });
    }
    for (const [material, batch] of batches) {
      const geometry = mergeGeometries(batch.geometries);
      if (!geometry) throw new Error('Unable to merge plant geometry');
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.plantTriangleRanges = batch.ranges;
      group.add(mesh);
    }
  } catch (error) {
    group.children.forEach((mesh) => mesh.geometry.dispose());
    throw error;
  } finally {
    for (const batch of batches.values()) batch.geometries.forEach((geometry) => geometry.dispose());
  }
  return { group, dispose() {
    group.children.forEach((mesh) => mesh.geometry.dispose());
    group.clear();
  } };
}

export function plantSlotAtHit(hit) {
  if (!Number.isInteger(hit.faceIndex) || hit.faceIndex < 0) return undefined;
  return hit.object.userData.plantTriangleRanges?.find((range) => hit.faceIndex < range.end)?.slot;
}
