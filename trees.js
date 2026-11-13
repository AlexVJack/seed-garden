import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom } from './plants.js';

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
const bark = material('#907052');
const leaves = ['#8fa96b', '#a8bc7b', '#78955d', '#b8c88b', '#95ae73'].map(material);
const needles = ['#315643', '#416b4d', '#537957', '#64865c'].map(material);
const baobabBark = material('#a58b76');
const savannaLeaves = ['#74834c', '#8f9754', '#a1a85e', '#667b47'].map(material);
const palmBark = material('#b3946b');
const palmRachis = material('#6b8950');
const palmLeaves = ['#527d4c', '#699452', '#83a45f'].map(material);
const leafGeometry = new THREE.IcosahedronGeometry(0.38, 0);
const needleGeometry = new THREE.ConeGeometry(1, 1, 7);
const up = new THREE.Vector3(0, 1, 0);

export function makeTree(kind, seed) {
  const random = createRandom(seed);
  const group = new THREE.Group();
  const pieces = [];
  const ownedGeometries = [];
  function grow(mesh, birth, span, scale = mesh.scale.clone()) {
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    pieces.push({ mesh, birth, span, scale });
    mesh.scale.setScalar(0);
  }
  function segment(origin, direction, length, bottomRadius, topRadius, birth, span, surface = bark) {
    const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 7);
    geometry.translate(0, length / 2, 0);
    ownedGeometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(up, direction);
    grow(mesh, birth, span, new THREE.Vector3(1, 1, 1));
  }
  function foliage(tip, birth, size) {
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(leafGeometry, leaves[Math.floor(random() * leaves.length)]);
      mesh.position.copy(tip).add(new THREE.Vector3((random() - 0.5) * 0.6, (random() - 0.25) * 0.5, (random() - 0.5) * 0.6));
      mesh.rotation.set(random() * 3, random() * 3, random() * 3);
      grow(mesh, birth + random() * 0.035, 0.14, new THREE.Vector3(size * 1.2, size * 0.85, size));
    }
  }
  function branch(origin, direction, length, radius, level, birth, span) {
    const position = origin.clone();
    const heading = direction.clone().normalize();
    const step = length / 5;
    for (let i = 0; i < 5; i++) {
      heading.add(new THREE.Vector3((random() - 0.5) * 0.16, 0.035, (random() - 0.5) * 0.16)).normalize();
      const bottomRadius = radius * (1 - i / 5 * 0.55);
      segment(position, heading, step, bottomRadius, radius * (1 - (i + 1) / 5 * 0.55), birth + span * i / 5, span / 5);
      position.addScaledVector(heading, step);
      if (level < 3 && (i === 2 || i === 4)) {
        const count = level === 0 ? 3 : 2;
        const baseAngle = random() * Math.PI * 2;
        for (let child = 0; child < count; child++) {
          const angle = baseAngle + child * Math.PI * 2 / count + random() * 0.4;
          const outward = new THREE.Vector3(Math.cos(angle), 0.55 + random() * 0.5, Math.sin(angle));
          const childDirection = heading.clone().multiplyScalar(0.35).add(outward).normalize();
          branch(position, childDirection, length * (0.53 + random() * 0.13), bottomRadius * 0.48, level + 1,
            birth + span * (i + 1) / 5, span * 0.65);
        }
      }
    }
    if (level >= 2) foliage(position, birth + span, level === 3 ? 0.9 + random() * 0.35 : 1.1);
  }

  if (kind === 'palm') {
    const height = 3.1 + random() * 0.65;
    const bend = new THREE.Vector3((random() - 0.5) * 0.8, 0, (random() - 0.5) * 0.8);
    const trunkPoint = (t) => new THREE.Vector3(bend.x * t * t, height * t, bend.z * t * t);
    for (let i = 0; i < 14; i++) {
      const origin = trunkPoint(i / 14);
      const delta = trunkPoint((i + 1) / 14).sub(origin);
      segment(origin, delta.clone().normalize(), delta.length(), 0.15 - i * 0.004, 0.14 - i * 0.004, i * 0.035, 0.07, palmBark);
    }
    const crown = trunkPoint(1);
    const count = 9 + Math.floor(random() * 4);
    const phase = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = phase + i * Math.PI * 2 / count;
      const reach = 1.2 + random() * 0.45;
      const surface = palmLeaves[Math.floor(random() * palmLeaves.length)];
      const point = (t) => crown.clone().add(new THREE.Vector3(Math.cos(angle) * reach * t, Math.sin(t * Math.PI) * 0.45 - t * t * 0.45, Math.sin(angle) * reach * t));
      for (let j = 0; j < 7; j++) {
        const t = j / 7;
        const origin = point(t);
        const delta = point((j + 1) / 7).sub(origin);
        segment(origin, delta.clone().normalize(), delta.length(), 0.022 * (1 - t) + 0.004, 0.006, 0.48 + t * 0.24, 0.13, palmRachis);
        if (j === 0) continue;
        for (const side of [-1, 1]) {
          const length = Math.sin(t * Math.PI) * (0.38 + random() * 0.08);
          const heading = new THREE.Vector3(Math.cos(angle) * 0.3 - Math.sin(angle) * side, -0.25, Math.sin(angle) * 0.3 + Math.cos(angle) * side).normalize();
          const blade = new THREE.Mesh(leafGeometry, surface);
          blade.position.copy(origin).addScaledVector(heading, length * 0.5);
          blade.quaternion.setFromUnitVectors(up, heading);
          grow(blade, 0.55 + t * 0.24, 0.14, new THREE.Vector3(0.12, length * 1.5, 0.04));
        }
      }
    }
  } else if (kind === 'baobab') {
    const height = 2.1 + random() * 0.55;
    const width = 0.48 + random() * 0.16;
    const lean = new THREE.Vector3((random() - 0.5) * 0.12, 1, (random() - 0.5) * 0.12).normalize();
    const radii = [1.12, 1.04, 1.08, 1.02, 0.86, 0.68, 0.53];
    for (let i = 0; i < radii.length - 1; i++) {
      segment(lean.clone().multiplyScalar(height * i / 6), lean, height / 6,
        width * radii[i], width * radii[i + 1], 0.02 + i * 0.045, 0.09, baobabBark);
    }
    const limbs = 5 + Math.floor(random() * 3);
    const baseAngle = random() * Math.PI * 2;
    for (let i = 0; i < limbs; i++) {
      const angle = baseAngle + i * Math.PI * 2 / limbs + (random() - 0.5) * 0.35;
      const origin = lean.clone().multiplyScalar(height * (0.83 + random() * 0.14));
      const heading = new THREE.Vector3(Math.cos(angle) * 0.65, 0.8 + random() * 0.5, Math.sin(angle) * 0.65).normalize();
      const length = 0.65 + random() * 0.55;
      segment(origin, heading, length, width * 0.36, 0.09, 0.3 + i * 0.012, 0.19, baobabBark);
      const fork = origin.clone().addScaledVector(heading, length);
      for (let j = 0; j < 3; j++) {
        const forkAngle = angle + (j - 1) * 0.85 + (random() - 0.5) * 0.3;
        const direction = new THREE.Vector3(Math.cos(forkAngle), 0.45 + random() * 0.7, Math.sin(forkAngle)).normalize();
        const reach = 0.4 + random() * 0.5;
        segment(fork, direction, reach, 0.085, 0.025, 0.5 + j * 0.025, 0.18, baobabBark);
        const tip = fork.clone().addScaledVector(direction, reach);
        const clusters = 2 + Math.floor(random() * 3);
        for (let k = 0; k < clusters; k++) {
          const mesh = new THREE.Mesh(leafGeometry, savannaLeaves[Math.floor(random() * savannaLeaves.length)]);
          mesh.position.copy(tip).add(new THREE.Vector3((random() - 0.5) * 0.5, random() * 0.12, (random() - 0.5) * 0.5));
          mesh.rotation.y = random() * Math.PI;
          const size = 0.65 + random() * 0.4;
          grow(mesh, 0.7 + random() * 0.1, 0.18, new THREE.Vector3(size * 1.1, size * 0.5, size));
        }
      }
    }
  } else if (kind === 'pine') {
    const height = 3.5 + random() * 0.7;
    const tiers = 9 + Math.floor(random() * 3);
    const lean = new THREE.Vector3((random() - 0.5) * 0.1, 1, (random() - 0.5) * 0.1).normalize();
    for (let i = 0; i < 12; i++) {
      segment(lean.clone().multiplyScalar(height * i / 12), lean, height / 12,
        0.12 * (1 - i / 12) + 0.012, 0.12 * (1 - (i + 1) / 12) + 0.01, i * 0.035, 0.07);
    }
    for (let tier = 0; tier < tiers; tier++) {
      const fraction = tier / tiers;
      const y = height * (0.18 + fraction * 0.74);
      const origin = lean.clone().multiplyScalar(y);
      const count = 5 + Math.floor(random() * 3);
      const base = random() * Math.PI * 2;
      const width = (1.45 - fraction * 1.25) * (0.85 + random() * 0.25);
      for (let b = 0; b < count; b++) {
        const angle = base + b * Math.PI * 2 / count + (random() - 0.5) * 0.28;
        const length = width * (0.75 + random() * 0.3);
        const heading = new THREE.Vector3(Math.cos(angle), -0.12 + random() * 0.2, Math.sin(angle)).normalize();
        const birth = 0.15 + fraction * 0.45;
        segment(origin, heading, length, 0.035 * (1 - fraction) + 0.008, 0.005, birth, 0.15);
        for (let tuft = 0; tuft < 3; tuft++) {
          const mesh = new THREE.Mesh(needleGeometry, needles[Math.floor(random() * needles.length)]);
          mesh.position.copy(origin).addScaledVector(heading, length * (0.3 + tuft * 0.27));
          const size = (0.21 + (1 - fraction) * 0.18) * (0.85 + random() * 0.3);
          mesh.rotation.set((random() - 0.5) * 0.35, random() * 6, (random() - 0.5) * 0.35);
          grow(mesh, birth + tuft * 0.035 + 0.08, 0.18, new THREE.Vector3(size, size * 1.9, size));
        }
      }
    }
    const tip = new THREE.Mesh(needleGeometry, needles[1]);
    tip.position.copy(lean).multiplyScalar(height * 0.96);
    grow(tip, 0.7, 0.2, new THREE.Vector3(0.2, 0.6, 0.2));
  } else {
    branch(new THREE.Vector3(), new THREE.Vector3((random() - 0.5) * 0.08, 1, (random() - 0.5) * 0.08), 2.65 + random() * 0.35, 0.17, 0, 0.025, 0.37);
  }
  const end = Math.max(...pieces.map((piece) => piece.birth + piece.span));
  pieces.forEach((piece) => { piece.birth /= end; piece.span /= end; });
  function finish() {
    if (!pieces.length) return;
    // Mature trees no longer need a draw call for every branch segment and leaf.
    const batches = new Map();
    for (const { mesh } of pieces) {
      mesh.updateMatrix();
      const geometries = batches.get(mesh.material) || [];
      geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
      batches.set(mesh.material, geometries);
    }
    group.clear();
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedGeometries.length = 0;
    for (const [surface, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      geometries.forEach((part) => part.dispose());
      ownedGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, surface);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    pieces.length = 0;
  }
  return { group, pieces, finish, dispose() { ownedGeometries.forEach((geometry) => geometry.dispose()); } };
}
