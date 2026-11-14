import * as THREE from 'three';
import { makeWorker } from './worker.js';
import { createMiningCycle, minerPosition } from './miner-logic.js';

export function makeMiner(quarry, groundY, strike) {
  const worker = makeWorker();
  const { figure, capsule, sphere, mesh, torso, leftArm, rightArm } = worker;
  const group = new THREE.Group();
  group.name = 'miner';
  group.add(figure);
  const position = minerPosition(quarry);
  figure.position.set(position.x, groundY, position.z);
  figure.rotation.y = Math.atan2(quarry.x - position.x, quarry.z - position.z);
  const wood = new THREE.MeshStandardMaterial({ color: '#9c7954', roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: '#78858e', roughness: 0.7, metalness: 0.25 });
  const pick = new THREE.Group();
  pick.name = 'pickaxe';
  rightArm.add(pick);
  pick.position.set(-0.06, -0.26, 0);
  pick.rotation.x = Math.PI / 2;
  mesh(pick, capsule, wood, 0, 0.12, 0, 0.018, 0.20, 0.018);
  // The head must lie in the swing plane, not across it: its forward point
  // reaches the quarry first as the handle swings down.
  const pickHead = new THREE.Group();
  pickHead.position.y = 0.40;
  pickHead.rotation.y = Math.PI / 2;
  pick.add(pickHead);
  const head = mesh(pickHead, sphere, metal, 0, 0, 0, 0.15, 0.032, 0.035);
  head.name = 'pickaxe-head';
  const pointGeometry = new THREE.ConeGeometry(0.032, 0.18, 8);
  const tip = mesh(pickHead, pointGeometry, metal, -0.19, -0.025, 0, 1, 1, 1);
  tip.name = 'pickaxe-tip';
  tip.rotation.z = Math.PI / 2 + 0.3;
  const back = mesh(pickHead, pointGeometry, metal, 0.19, -0.025, 0, 1, 1, 1);
  back.rotation.z = -Math.PI / 2 - 0.3;
  const cycle = createMiningCycle(strike);
  function update(delta, active) {
    cycle.advance(delta, active);
    const time = cycle.elapsed;
    // Rest, raise, then swing down. Impact at the 3-second boundary is also
    // the single resource event; there is no independent timer to drift.
    const lift = time < 1500 ? 0 : time < 2400 ? (time - 1500) / 900 : (3000 - time) / 600;
    const smoothLift = lift * lift * (3 - 2 * lift);
    rightArm.rotation.x = -0.65 - smoothLift * 2.0;
    leftArm.rotation.x = -0.8 - smoothLift * 1.5;
    leftArm.rotation.z = 0.3;
    torso.rotation.x = (1 - smoothLift) * 0.15;
  }
  update(0, false);
  return {
    group, update,
    dispose() {
      worker.dispose();
      pointGeometry.dispose();
      wood.dispose();
      metal.dispose();
    },
  };
}
