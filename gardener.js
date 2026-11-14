import * as THREE from 'three';
import { createGatheringCycle, gardenerRoute } from './gardener-logic.js';
import { makeWorker } from './worker.js';

export function makeGardener(quarry, groundY, collect, biome = 'meadow') {
  const group = new THREE.Group();
  const worker = makeWorker();
  const { figure, sphere, capsule, mesh, hip, torso, leftArm, rightArm, leftLeg, rightLeg } = worker;
  group.add(figure);
  const fruitMaterial = new THREE.MeshStandardMaterial({ color: '#ce7c43', roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#739252', roughness: 0.9 });
  const shellMaterial = new THREE.MeshStandardMaterial({ color: '#725437', roughness: 0.95 });
  const fruit = new THREE.Group();
  fruit.userData.biome = biome;
  group.add(fruit);
  if (biome === 'conifer') {
    fruitMaterial.color.set('#9d714b');
    mesh(fruit, sphere, fruitMaterial, 0, 0.09, 0, 0.06, 0.10, 0.06);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI * 2 / 3;
      mesh(fruit, sphere, shellMaterial, Math.cos(angle) * 0.045, 0.06 + Math.floor(i / 3) * 0.06, Math.sin(angle) * 0.045, 0.035, 0.025, 0.035);
    }
  } else if (biome === 'savanna') {
    fruitMaterial.color.set('#b49a60');
    mesh(fruit, sphere, fruitMaterial, 0, 0.07, 0, 0.06, 0.06, 0.12);
    mesh(fruit, capsule, shellMaterial, 0, 0.07, -0.13, 0.012, 0.025, 0.012).rotation.x = Math.PI / 2;
  } else if (biome === 'desert') {
    fruitMaterial.color.set('#a17a50');
    mesh(fruit, sphere, fruitMaterial, 0, 0.09, 0, 0.10, 0.09, 0.085);
    for (const [x, z] of [[-0.025, 0.01], [0.025, 0.01], [0, -0.025]]) {
      mesh(fruit, sphere, shellMaterial, x, 0.175, z, 0.012, 0.006, 0.012);
    }
  } else if (biome === 'blossom') {
    fruitMaterial.color.set('#b95162');
    for (const x of [-0.035, 0.035]) {
      mesh(fruit, sphere, fruitMaterial, x, 0.045, 0, 0.045, 0.045, 0.045);
      mesh(fruit, capsule, leafMaterial, x / 2, 0.11, 0, 0.006, 0.035, 0.006).rotation.z = x < 0 ? -0.4 : 0.4;
    }
  } else if (biome === 'darkForest') {
    fruitMaterial.color.set('#ba8e4f');
    mesh(fruit, sphere, fruitMaterial, 0, 0.065, 0, 0.06, 0.075, 0.06);
    mesh(fruit, sphere, shellMaterial, 0, 0.12, 0, 0.075, 0.035, 0.075);
    mesh(fruit, capsule, shellMaterial, 0, 0.16, 0, 0.009, 0.012, 0.009);
  } else if (biome === 'autumn') {
    fruitMaterial.color.set('#c9a05b');
    for (const sign of [-1, 1]) {
      const wing = mesh(fruit, sphere, fruitMaterial, sign * 0.07, 0.025, 0.04, 0.085, 0.012, 0.032);
      wing.rotation.y = -sign * 0.5;
      mesh(fruit, sphere, shellMaterial, sign * 0.018, 0.025, 0, 0.025, 0.02, 0.025);
    }
  } else {
    mesh(fruit, sphere, fruitMaterial, 0, 0.07, 0, 0.075, 0.075, 0.07);
    const leaf = mesh(fruit, sphere, leafMaterial, 0.035, 0.15, 0, 0.045, 0.012, 0.02);
    leaf.rotation.z = 0.5;
  }

  const route = gardenerRoute(quarry);
  let from = 0;
  let to = 1;
  let direction = 1;
  const cycle = createGatheringCycle(collect);
  function placeFruit() {
    const start = route[from];
    const end = route[to];
    const heading = Math.atan2(end.x - start.x, end.z - start.z);
    fruit.position.set(end.x + Math.sin(heading) * 0.22, groundY, end.z + Math.cos(heading) * 0.22);
  }
  placeFruit();
  function update(delta, active) {
    if (cycle.advance(delta, active)) {
      from = to;
      if (to === route.length - 1 || to === 0) direction *= -1;
      to += direction;
      placeFruit();
    }
    const time = cycle.elapsed;
    const walk = Math.min(time / 1700, 1);
    const start = route[from];
    const end = route[to];
    figure.position.set(THREE.MathUtils.lerp(start.x, end.x, walk), groundY, THREE.MathUtils.lerp(start.z, end.z, walk));
    figure.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
    const stride = time < 1700 && active ? Math.sin(walk * Math.PI * 6) * 0.5 : 0;
    const bend = time < 1700 ? 0 : time < 2300 ? (time - 1700) / 600 : time < 2500 ? 1 : Math.max(0, (3000 - time) / 500);
    const smoothBend = bend * bend * (3 - 2 * bend);
    hip.position.y = 0.36 - smoothBend * 0.09;
    torso.rotation.x = smoothBend * 1.15;
    leftLeg.rotation.x = stride;
    rightLeg.rotation.x = -stride;
    leftArm.rotation.x = -stride * 0.7 - smoothBend * 0.25;
    rightArm.rotation.x = stride * 0.7 - smoothBend * 0.8;
    fruit.visible = active && !cycle.picked;
  }
  update(0, false);
  return {
    group,
    update,
    dispose() {
      worker.dispose();
      fruitMaterial.dispose();
      leafMaterial.dispose();
      shellMaterial.dispose();
    },
  };
}
