import * as THREE from 'three';

// Both jobs use the same small, untextured figure and joint layout.
export function makeWorker() {
  const figure = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const capsule = new THREE.CapsuleGeometry(1, 1, 4, 8);
  const blue = new THREE.MeshStandardMaterial({ color: '#58afe0', roughness: 0.8 });
  function mesh(parent, geometry, material, x, y, z, sx, sy, sz) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.scale.set(sx, sy, sz);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    // Decorative workers never intercept planting, shears or mining clicks.
    part.raycast = () => {};
    return part;
  }
  function limb(parent, x, y, length, radius) {
    const joint = new THREE.Group();
    joint.position.set(x, y, 0);
    parent.add(joint);
    mesh(joint, capsule, blue, 0, -length / 2, 0, radius, length / 3, radius);
    return joint;
  }
  const hip = new THREE.Group();
  hip.position.y = 0.36;
  figure.add(hip);
  mesh(hip, sphere, blue, 0, 0.02, 0, 0.115, 0.11, 0.09);
  const torso = new THREE.Group();
  hip.add(torso);
  mesh(torso, sphere, blue, 0, 0.18, 0, 0.13, 0.23, 0.09);
  mesh(torso, sphere, blue, 0, 0.47, 0, 0.135, 0.145, 0.13);
  const leftArm = limb(torso, -0.15, 0.30, 0.32, 0.05);
  const rightArm = limb(torso, 0.15, 0.30, 0.32, 0.05);
  const leftLeg = limb(hip, -0.07, 0, 0.32, 0.055);
  const rightLeg = limb(hip, 0.07, 0, 0.32, 0.055);
  return {
    figure, sphere, capsule, mesh, hip, torso, leftArm, rightArm, leftLeg, rightLeg,
    dispose() {
      sphere.dispose();
      capsule.dispose();
      blue.dispose();
    },
  };
}
