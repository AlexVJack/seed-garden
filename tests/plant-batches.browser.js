import * as THREE from 'three';
import { makePlant } from '../plants.js';
import { makePlantBatch, plantSlotAtHit } from '../plant-batches.js';
import { plantingSlots, treeBiomes, parcelPosition } from '../garden-layout.js';
import { makeTree } from '../trees.js';
import { makeTerrain } from '../terrain.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const records = plantingSlots.map((_, slot) => ({ slot, seed: 12345 + slot * 739, type: ['flower', 'mushroom', 'bush'][slot % 3] }));
const groundY = 0.26;
function unbatched(plants, biome) {
  const group = new THREE.Group();
  for (const record of plants) {
    const plant = makePlant(record.type, record.seed, biome);
    const slot = plantingSlots[record.slot];
    plant.position.set(slot.x, groundY, slot.z);
    plant.userData.plantSlot = record.slot;
    group.add(plant);
  }
  return group;
}
function originalSlot(hit) {
  for (let object = hit?.object; object; object = object.parent) {
    if (object.userData.plantSlot !== undefined) return object.userData.plantSlot;
  }
}
function triangleCount(group) {
  let count = 0;
  group.traverse(mesh => { if (mesh.isMesh) count += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; });
  return count;
}
function worldVertices(group) {
  const result = new Map();
  group.updateMatrixWorld(true);
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const vertices = result.get(mesh.material) || [];
    const geometry = mesh.geometry;
    const p = new THREE.Vector3();
    for (let i = 0; i < (geometry.index?.count ?? geometry.attributes.position.count); i++) {
      p.fromBufferAttribute(geometry.attributes.position, geometry.index ? geometry.index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      vertices.push(p.x, p.y, p.z);
    }
    result.set(mesh.material, vertices);
  });
  return result;
}

async function run() {
  for (const kind of ['darkOak', 'maple']) {
    const tree = makeTree(kind, 93421);
    const sameTree = makeTree(kind, 93421);
    assert(tree.pieces.length > 0, `${kind} has growing geometry`);
    assert(tree.pieces.length === sameTree.pieces.length, `${kind} seed reproduces piece count`);
    tree.pieces.forEach((piece, i) => {
      const other = sameTree.pieces[i];
      assert(piece.mesh.position.equals(other.mesh.position) && piece.scale.equals(other.scale)
        && piece.mesh.quaternion.equals(other.mesh.quaternion), `${kind} seeded shape is stable`);
      assert(piece.birth >= 0 && piece.birth + piece.span <= 1.000001, `${kind} growth stays within its duration`);
      piece.mesh.scale.copy(piece.scale);
    });
    tree.group.updateMatrixWorld(true);
    const beforeFinish = worldVertices(tree.group);
    tree.finish();
    const afterFinish = worldVertices(tree.group);
    for (const [surface, vertices] of beforeFinish) {
      const actual = afterFinish.get(surface);
      assert(actual?.length === vertices.length, `mature ${kind} preserves geometry`);
      vertices.forEach((value, i) => assert(Math.abs(value - actual[i]) < 0.00001, `mature ${kind} preserves vertices`));
    }
    tree.dispose();
    sameTree.dispose();
  }
  const terrain = makeTerrain();
  terrain.setBiome('meadow');
  const meadowColor = terrain.ground.material.color.clone();
  const visibleBefore = terrain.group.children.map(child => child.visible);
  for (const biome of ['darkForest', 'autumn']) {
    terrain.setBiome(biome);
    assert(!terrain.ground.material.color.equals(meadowColor), `${biome} has distinct soil`);
    terrain.setBiome('meadow');
    assert(terrain.ground.material.color.equals(meadowColor), `canceling ${biome} preview restores soil`);
    assert(terrain.group.children.every((child, i) => child.visible === visibleBefore[i]), `canceling ${biome} preview restores decoration`);
  }
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(320, 320);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f4ed');
  scene.add(new THREE.HemisphereLight('#fffbeb', '#a3ad8d', 2.5));
  const light = new THREE.DirectionalLight('#fff3d5', 3.2);
  light.position.set(-3, 12, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  Object.assign(light.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 35 });
  light.shadow.normalBias = 0.035;
  scene.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#a8b782' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);
  camera.position.set(4, 5, 5);
  camera.lookAt(0, 0, 0);
  const target = new THREE.WebGLRenderTarget(320, 320);
  function renderPixels(group) {
    scene.add(group);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const calls = renderer.info.render.calls;
    const pixels = new Uint8Array(320 * 320 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 320, 320, pixels);
    scene.remove(group);
    return { pixels, calls };
  }
  const report = [];
  for (const biome of Object.values(treeBiomes)) {
    const original = unbatched(records, biome);
    const batch = makePlantBatch(records, biome, groundY);
    assert(triangleCount(original) === triangleCount(batch.group), `${biome}: triangle count changed`);
    const expected = worldVertices(original);
    const actual = worldVertices(batch.group);
    assert(expected.size === actual.size, `${biome}: materials changed`);
    for (const [material, values] of expected) {
      const merged = actual.get(material);
      assert(merged?.length === values.length, `${biome}: vertex count changed`);
      assert(values.every((v, i) => Math.abs(v - merged[i]) < 0.000002), `${biome}: vertex positions changed`);
    }
    original.updateMatrixWorld(true);
    batch.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const hitSlots = new Set();
    for (const slot of plantingSlots) {
      for (const dx of [-0.07, 0, 0.07]) {
        for (const direction of [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.12, -1, 0.08).normalize()]) {
          const point = new THREE.Vector3(slot.x + dx, groundY, slot.z);
          ray.set(point.clone().addScaledVector(direction, -3), direction);
          const before = ray.intersectObject(original, true)[0];
          const after = ray.intersectObject(batch.group, true)[0];
          const expectedSlot = originalSlot(before);
          const actualSlot = after ? plantSlotAtHit(after) : undefined;
          assert(expectedSlot === actualSlot, `${biome}: shears select a different plant`);
          if (actualSlot !== undefined) hitSlots.add(actualSlot);
        }
      }
    }
    assert(hitSlots.size === 24, `${biome}: not every plant can be picked`);
    const before = renderPixels(original);
    const after = renderPixels(batch.group);
    let absoluteError = 0;
    let changedPixels = 0;
    for (let i = 0; i < before.pixels.length; i += 4) {
      let delta = 0;
      for (let c = 0; c < 3; c++) delta += Math.abs(before.pixels[i + c] - after.pixels[i + c]);
      absoluteError += delta;
      if (delta > 12) changedPixels++;
    }
    const meanError = absoluteError / (320 * 320 * 3);
    assert(meanError < 0.2 && changedPixels / (320 * 320) < 0.005, `${biome}: render differs: ${meanError}, ${changedPixels} pixels`);
    assert(after.calls < before.calls / 2, `${biome}: too many draw calls`);
    // Every face, including material/plant boundaries, must map to its source slot.
    for (const mesh of batch.group.children) {
      let start = 0;
      for (const range of mesh.userData.plantTriangleRanges) {
        assert(plantSlotAtHit({ object: mesh, faceIndex: start }) === range.slot, 'range start');
        assert(plantSlotAtHit({ object: mesh, faceIndex: range.end - 1 }) === range.slot, 'range end');
        start = range.end;
      }
      assert(plantSlotAtHit({ object: mesh, faceIndex: start }) === undefined, 'out-of-range face');
    }
    let disposed = 0;
    batch.group.children.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed++));
    const meshCount = batch.group.children.length;
    const shared = original.children[0].children[0];
    let sharedDisposed = false;
    shared.geometry.addEventListener('dispose', () => { sharedDisposed = true; });
    shared.material.addEventListener('dispose', () => { sharedDisposed = true; });
    batch.dispose();
    batch.dispose();
    assert(disposed === meshCount && !sharedDisposed, 'incorrect resource ownership');
    report.push({ biome, beforeCalls: before.calls, afterCalls: after.calls, meanPixelError: meanError, changedPixels });
  }
  const empty = makePlantBatch([], 'meadow', groundY);
  assert(empty.group.children.length === 0, 'empty batch');
  empty.dispose();
  assert(plantSlotAtHit({ object: floor, faceIndex: 0 }) === undefined, 'non-plant hit');
  assert(plantSlotAtHit({ object: floor, faceIndex: null }) === undefined, 'missing face');
  // Repeated rebuilds must release uploaded batch geometry without disposing shared primitives/materials.
  renderPixels(new THREE.Group());
  const memoryBefore = renderer.info.memory.geometries;
  for (let i = 0; i < 20; i++) {
    const batch = makePlantBatch(records.filter(p => p.slot !== i % 24), Object.values(treeBiomes)[i % 5], groundY);
    renderPixels(batch.group);
    batch.dispose();
  }
  assert(renderer.info.memory.geometries === memoryBefore, 'GPU geometry count grows after rebuilds');

  // Same 36 full plots, camera, lighting and triangles; measure renderer submission, not user-device FPS.
  const gardens = [new THREE.Group(), new THREE.Group()];
  const owned = [];
  for (let id = 0; id < 36; id++) {
    const biome = Object.values(treeBiomes)[id % 5];
    const position = parcelPosition({ q: id % 6, r: Math.floor(id / 6) });
    const before = unbatched(records, biome);
    const after = makePlantBatch(records, biome, groundY);
    for (const group of [before, after.group]) group.position.set(position.x, 0, position.z);
    gardens[0].add(before);
    gardens[1].add(after.group);
    owned.push(after);
  }
  camera.position.set(40, 40, 50);
  camera.lookAt(17, 0, 10);
  const benchmark = gardens.map(group => {
    scene.add(group);
    renderer.render(scene, camera);
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      renderer.render(scene, camera);
      times.push(performance.now() - start);
    }
    const calls = renderer.info.render.calls;
    scene.remove(group);
    return { calls, medianSubmissionMs: times.sort((a, b) => a - b)[2] };
  });
  owned.forEach(batch => batch.dispose());
  target.dispose();
  renderer.dispose();
  return { report, benchmark, memoryStable: true };
}

run().then(result => {
  window.testResult = result;
  document.querySelector('#result').textContent = 'PASS\n' + JSON.stringify(result, null, 2);
}).catch(error => {
  window.testError = error.stack;
  document.querySelector('#result').textContent = 'FAIL\n' + error.stack;
  console.error(error);
});
