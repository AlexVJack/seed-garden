import * as THREE from 'three';

import { createRandom } from './random.js';
export { createRandom } from './random.js';

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
const greens = ['#7d9a60', '#94ac71', '#658554', '#adc185'].map(material);
const flowers = ['#df9ca8', '#e9c16c', '#b4a1cb', '#e9e0bf', '#d98970'].map(material);
const caps = ['#b56e54', '#c89972', '#bc786e', '#9f8565'].map(material);
const coniferGreens = ['#3e604b', '#54765b', '#6c8963'].map(material);
const whiteFlowers = ['#f5f2e6', '#e8eee6', '#fffaf0'].map(material);
const brownCaps = ['#806044', '#997652', '#6d503c'].map(material);
const dryGreens = ['#969057', '#b5a16b', '#7e804e', '#c0a375'].map(material);
const orangeFlowers = ['#e78735', '#eea044', '#ce652b', '#f1ad58'].map(material);
const morelCaps = ['#947044', '#ad8953', '#84643e'].map(material);
const morelRidge = material('#c5a16a');
const desertGreens = ['#749578', '#8eaa8b', '#537e6b'].map(material);
const cactusRib = material('#a0b38a');
const spines = material('#eee0b5');
const desertBlooms = ['#e29ba7', '#f0cb6b'].map(material);
const groveGreens = ['#587e68', '#72947a', '#8ca58b'].map(material);
const groveFlowers = ['#f6f0ed', '#d4c1e5', '#b7a4ce'].map(material);
const groveCaps = ['#b18a88', '#c3a29a', '#d5bca9'].map(material);
const azaleaBlooms = ['#edafc4', '#d987aa', '#fff0ed'].map(material);
const forestGreens = ['#35583d', '#486b46', '#5c7b4e'].map(material);
const berries = ['#42466e', '#555381', '#666192'].map(material);
const chanterelles = ['#d99535', '#edb34e', '#e5a13d'].map(material);
const cream = material('#eee2c3');
const center = material('#d5ab59');
const barkMaterial = material('#786049');
const sphere = new THREE.SphereGeometry(1, 8, 6);
const leaf = new THREE.IcosahedronGeometry(1, 0);
const stem = new THREE.CylinderGeometry(0.018, 0.023, 1, 6);
const cap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const cone = new THREE.ConeGeometry(1, 1, 7);
const morel = new THREE.SphereGeometry(1, 10, 8);
const ridge = new THREE.TorusGeometry(1, 0.13, 4, 10);
// Shared open-ended bells and rippled funnels remain compatible with plant batching.
const bell = new THREE.CylinderGeometry(0.45, 1, 1, 8, 1, true);
const funnel = new THREE.LatheGeometry([
  new THREE.Vector2(0.12, -0.35), new THREE.Vector2(0.4, -0.1),
  new THREE.Vector2(0.8, 0.12), new THREE.Vector2(1, 0.3),
  new THREE.Vector2(0.96, 0.37), new THREE.Vector2(0.73, 0.2),
  new THREE.Vector2(0.28, -0.04),
], 16);
const funnelPositions = funnel.attributes.position;
for (let i = 0; i < funnelPositions.count; i++) {
  const angle = Math.atan2(funnelPositions.getZ(i), funnelPositions.getX(i));
  const radius = Math.hypot(funnelPositions.getX(i), funnelPositions.getZ(i));
  funnelPositions.setY(i, funnelPositions.getY(i) + Math.sin(angle * 5) * 0.075 * radius);
}
funnel.computeVertexNormals();

export function makePlant(type, seed, biome = 'meadow') {
  const conifer = biome === 'conifer';
  const savanna = biome === 'savanna';
  const blossom = biome === 'blossom';
  const forest = biome === 'darkForest';
  const greenPalette = forest ? forestGreens : blossom ? groveGreens : savanna ? dryGreens : conifer ? coniferGreens : greens;
  const flowerPalette = blossom ? groveFlowers : savanna ? orangeFlowers : conifer ? whiteFlowers : flowers;
  const capPalette = blossom ? groveCaps : conifer ? brownCaps : caps;
  const random = createRandom(seed);
  const group = new THREE.Group();
  group.rotation.y = random() * Math.PI * 2;
  function add(geometry, surface, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  const green = greenPalette[Math.floor(random() * greenPalette.length)];
  if (forest) {
    if (type === 'flower') {
      const height = 0.28 + random() * 0.09;
      for (const side of [-1, 1]) {
        const blade = add(leaf, green, side * 0.065, height * 0.35, 0, 0.065, height * 0.65, 0.035);
        blade.rotation.z = -side * 0.4;
      }
      let previous = new THREE.Vector3();
      for (let i = 1; i <= 7; i++) {
        const t = i / 7;
        const point = new THREE.Vector3(0.11 * t * t, height * (t - 0.15 * t ** 4), 0);
        const delta = point.clone().sub(previous);
        const stalk = add(stem, green, (point.x + previous.x) / 2, (point.y + previous.y) / 2, 0, 0.4, delta.length(), 0.4);
        stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        if (i >= 3) {
          const x = point.x + 0.025;
          const y = point.y - 0.025;
          add(stem, green, x - 0.012, y + 0.014, 0, 0.3, 0.04, 0.3).rotation.z = -0.7;
          add(bell, whiteFlowers[i % whiteFlowers.length], x, y - 0.012, 0, 0.028, 0.036, 0.028);
          for (let lobe = 0; lobe < 5; lobe++) {
            const a = lobe * Math.PI * 2 / 5;
            add(sphere, whiteFlowers[i % whiteFlowers.length], x + Math.cos(a) * 0.023, y - 0.03, Math.sin(a) * 0.023, 0.01, 0.008, 0.01);
          }
        }
        previous = point;
      }
    } else if (type === 'mushroom') {
      const count = 3 + Math.floor(random() * 2);
      const surface = chanterelles[Math.floor(random() * chanterelles.length)];
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count + random() * 0.3;
        const x = Math.cos(angle) * 0.075;
        const z = Math.sin(angle) * 0.075;
        const height = 0.12 + random() * 0.12;
        const radius = 0.075 + random() * 0.035;
        add(stem, surface, x, height / 2, z, 1.5, height, 1.5);
        add(funnel, surface, x, height, z, radius, radius, radius).rotation.y = random() * Math.PI;
      }
    } else if (type === 'bush') {
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        const x = Math.cos(angle) * 0.1;
        const z = Math.sin(angle) * 0.1;
        const y = 0.13 + random() * 0.1;
        const size = 0.1 + random() * 0.035;
        add(stem, barkMaterial, x, y / 2, z, 0.55, y, 0.55);
        add(leaf, forestGreens[i % forestGreens.length], x, y, z, size, size * 0.85, size);
        for (let j = 0; j < 3; j++) {
          const a = angle + (j - 1) * 0.65;
          add(sphere, berries[(i + j) % berries.length], x + Math.cos(a) * size * 0.8,
            y + size * 0.35 + random() * 0.035, z + Math.sin(a) * size * 0.8, 0.025, 0.023, 0.025);
        }
      }
    }
    return group;
  }
  if (biome === 'desert') {
    const surface = desertGreens[Math.floor(random() * desertGreens.length)];
    if (type === 'mushroom') {
      const radius = 0.13 + random() * 0.045;
      const height = radius * (1.1 + random() * 0.35);
      add(sphere, surface, 0, height * 0.85, 0, radius, height, radius);
      for (let rib = 0; rib < 9; rib++) {
        const angle = rib * Math.PI * 2 / 9;
        add(sphere, cactusRib, Math.cos(angle) * radius * 0.84, height * 0.85, Math.sin(angle) * radius * 0.84, radius * 0.22, height * 0.92, radius * 0.22);
        for (let row = 0; row < 3; row++) {
          const y = height * (0.4 + row * 0.45);
          const r = radius * Math.sqrt(1 - ((y - height * 0.85) / height) ** 2);
          const spike = add(cone, spines, Math.cos(angle) * (r + 0.012), y, Math.sin(angle) * (r + 0.012), 0.008, 0.05, 0.008);
          spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(angle), 0.25, Math.sin(angle)).normalize());
        }
      }
    } else {
      const agave = type === 'bush';
      const count = agave ? 11 : 14;
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / (agave ? count : 7) + (i >= 7 ? 0.35 : 0);
        const length = (agave ? 0.34 : i < 7 ? 0.2 : 0.14) * (0.85 + random() * 0.3);
        const direction = new THREE.Vector3(Math.cos(angle), agave ? 0.7 + random() : 0.35, Math.sin(angle)).normalize();
        const blade = add(agave ? cone : leaf, surface, direction.x * length * 0.48, 0.03 + direction.y * length * 0.48, direction.z * length * 0.48, agave ? 0.045 : 0.055, length * (agave ? 1 : 0.6), agave ? 0.018 : 0.025);
        blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      }
      if (!agave) {
        const height = 0.23 + random() * 0.08;
        add(stem, surface, 0, height / 2, 0, 0.6, height, 0.6);
        const bloom = desertBlooms[Math.floor(random() * desertBlooms.length)];
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * 2 / 5;
          add(sphere, bloom, Math.cos(angle) * 0.035, height, Math.sin(angle) * 0.035, 0.035, 0.02, 0.035);
        }
        add(sphere, center, 0, height + 0.01, 0, 0.02, 0.02, 0.02);
      }
    }
    return group;
  }
  if (type === 'flower') {
    const height = (blossom ? 0.16 : 0.23) + random() * (blossom ? 0.1 : 0.16);
    group.rotation.z = (random() - 0.5) * 0.15;
    add(stem, green, 0, height / 2, 0, 1, height, 1);
    add(leaf, green, 0.07, height * 0.45, 0, 0.1, 0.035, 0.045).rotation.z = 0.4;
    const surface = flowerPalette[Math.floor(random() * flowerPalette.length)];
    const count = 5 + Math.floor(random() * 3);
    const radius = 0.07 + random() * 0.025;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const petal = add(sphere, surface, Math.cos(angle) * radius, height, Math.sin(angle) * radius, radius, 0.035, radius * 0.62);
      petal.rotation.y = -angle;
    }
    add(sphere, center, 0, height + 0.02, 0, 0.045, 0.035, 0.045);
  } else if (type === 'mushroom') {
    if (savanna) {
      const height = 0.12 + random() * 0.07;
      const radius = 0.075 + random() * 0.025;
      const capHeight = 0.13 + random() * 0.05;
      add(stem, cream, 0, height / 2, 0, 2.2, height, 2.2);
      add(morel, morelCaps[Math.floor(random() * morelCaps.length)], 0, height + capHeight * 0.65, 0, radius, capHeight, radius);
      // Raised intersecting ridges suggest a morel's pitted cap without textures.
      for (let i = 0; i < 5; i++) {
        const band = add(ridge, morelRidge, 0, height + capHeight * 0.65, 0, radius, capHeight, radius);
        band.rotation.y = i * Math.PI / 5;
      }
      for (let i = 0; i < 4; i++) {
        const fraction = (i + 1) / 5 * 2 - 1;
        const r = radius * Math.sqrt(1 - fraction * fraction);
        const band = add(ridge, morelRidge, 0, height + capHeight * (0.65 + fraction), 0, r, r, r);
        band.rotation.x = Math.PI / 2;
      }
      return group;
    }
    const height = 0.13 + random() * 0.12;
    const radius = 0.12 + random() * 0.055;
    add(stem, cream, 0, height / 2, 0, 2 + random(), height, 2 + random());
    add(cap, capPalette[Math.floor(random() * capPalette.length)], 0, height, 0, radius, radius * 0.7, radius);
    add(sphere, cream, 0, height, 0, radius * 0.96, 0.012, radius * 0.96);
    const count = 3 + Math.floor(random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const r = 0.2 + random() * 0.6;
      add(sphere, cream, Math.cos(angle) * radius * r, height + radius * 0.7 * Math.sqrt(1 - r * r), Math.sin(angle) * radius * r, 0.018, 0.008, 0.018);
    }
  } else if (type === 'bush') {
    if (savanna) {
      const count = 5 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count + random() * 0.3;
        const height = 0.2 + random() * 0.18;
        const direction = new THREE.Vector3(Math.cos(angle) * 0.5, 1, Math.sin(angle) * 0.5).normalize();
        const twig = add(stem, barkMaterial, direction.x * height / 2, direction.y * height / 2, direction.z * height / 2, 0.55, height, 0.55);
        twig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        if (random() < 0.65) {
          const size = 0.065 + random() * 0.035;
          add(leaf, greenPalette[Math.floor(random() * greenPalette.length)], direction.x * height, direction.y * height, direction.z * height, size, size * 0.6, size);
        }
      }
      return group;
    }
    if (conifer) {
      const count = 2 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2;
        const x = Math.cos(angle) * 0.09;
        const z = Math.sin(angle) * 0.09;
        const height = 0.22 + random() * 0.2;
        add(stem, barkMaterial, x, height / 2, z, 0.6, height, 0.6);
        for (let tier = 0; tier < 3; tier++) {
          const radius = (0.12 - tier * 0.026) * (0.8 + random() * 0.3);
          add(cone, greenPalette[Math.floor(random() * greenPalette.length)], x, height * (0.35 + tier * 0.22), z, radius, height * 0.55, radius);
        }
      }
      return group;
    }
    const count = 5 + Math.floor(random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const r = random() * 0.1;
      const size = 0.1 + random() * 0.055;
      const x = Math.cos(angle) * r;
      const surfaceGreen = greenPalette[Math.floor(random() * greenPalette.length)];
      const y = 0.12 + random() * 0.12;
      const z = Math.sin(angle) * r;
      add(leaf, surfaceGreen, x, y, z, size, size * (0.9 + random() * 0.5), size);
      if (blossom) {
        const surface = azaleaBlooms[Math.floor(random() * azaleaBlooms.length)];
        for (let petal = 0; petal < 5; petal++) {
          const a = petal * Math.PI * 2 / 5;
          add(sphere, surface, x + Math.cos(a) * 0.035, y + size * 0.8, z + Math.sin(a) * 0.035, 0.035, 0.018, 0.035);
        }
        add(sphere, center, x, y + size * 0.8 + 0.01, z, 0.015, 0.012, 0.015);
      }
    }
  }
  return group;
}
