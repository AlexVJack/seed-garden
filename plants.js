import * as THREE from 'three';

export function createRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
const greens = ['#7d9a60', '#94ac71', '#658554', '#adc185'].map(material);
const flowers = ['#df9ca8', '#e9c16c', '#b4a1cb', '#e9e0bf', '#d98970'].map(material);
const caps = ['#b56e54', '#c89972', '#bc786e', '#9f8565'].map(material);
const coniferGreens = ['#3e604b', '#54765b', '#6c8963'].map(material);
const whiteFlowers = ['#f5f2e6', '#e8eee6', '#fffaf0'].map(material);
const brownCaps = ['#806044', '#997652', '#6d503c'].map(material);
const cream = material('#eee2c3');
const center = material('#d5ab59');
const barkMaterial = material('#786049');
const sphere = new THREE.SphereGeometry(1, 8, 6);
const leaf = new THREE.IcosahedronGeometry(1, 0);
const stem = new THREE.CylinderGeometry(0.018, 0.023, 1, 6);
const cap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const cone = new THREE.ConeGeometry(1, 1, 7);

export function makePlant(type, seed, biome = 'meadow') {
  const conifer = biome === 'conifer';
  const greenPalette = conifer ? coniferGreens : greens;
  const flowerPalette = conifer ? whiteFlowers : flowers;
  const capPalette = conifer ? brownCaps : caps;
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
  if (type === 'flower') {
    const height = 0.23 + random() * 0.16;
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
      add(leaf, greens[Math.floor(random() * greens.length)], Math.cos(angle) * r, 0.12 + random() * 0.12, Math.sin(angle) * r, size, size * (0.9 + random() * 0.5), size);
    }
  }
  return group;
}
