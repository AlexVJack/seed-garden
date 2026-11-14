import * as THREE from 'three';
import { createRandom } from './plants.js';
import { plantingSlots, terrainSeed } from './garden-layout.js';
import { quarryLayout, quarryRadius } from './terrain-layout.js';

export const groundY = 0.26;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const soilGeometry = new THREE.CylinderGeometry(2.65, 2.25, 0.65, 6);
const groundGeometry = new THREE.CylinderGeometry(2.67, 2.65, 0.12, 6);
const grassGeometry = new THREE.ConeGeometry(0.025, 1, 3);
const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
const rockMaterial = material('#b1b4b2');
const rippleGeometry = new THREE.TorusGeometry(0.15, 0.008, 3, 12, Math.PI * 0.85);
const petalGeometry = new THREE.SphereGeometry(1, 5, 3);
const petalMaterial = material('#efd0dc');

export function makeTerrain({ q = 0, r = 0 } = {}) {
  const group = new THREE.Group();
  const earth = material('#a68563');
  const turf = material('#a8b782');
  const grass = material('#899e69');
  const stones = rockMaterial.clone();
  const sandRidges = material('#dfc38b');
  const soil = new THREE.Mesh(soilGeometry, earth);
  soil.position.y = -0.115;
  soil.castShadow = soil.receiveShadow = true;
  const ground = new THREE.Mesh(groundGeometry, turf);
  ground.position.y = groundY - 0.06;
  ground.receiveShadow = true;
  group.add(soil, ground);
  const random = createRandom(terrainSeed({ q, r }));
  const hueShift = (random() - 0.5) * 0.015;
  const lightnessShift = (random() - 0.5) * 0.05;
  const layout = quarryLayout({ q, r });
  const quarryRandom = createRandom(layout.shapeSeed);
  const quarryGeometry = rockGeometry.clone();
  const vertices = quarryGeometry.attributes.position;
  const shapes = new Map();
  for (let i = 0; i < vertices.count; i++) {
    const key = `${vertices.getX(i)},${vertices.getY(i)},${vertices.getZ(i)}`;
    if (!shapes.has(key)) shapes.set(key, 0.76 + quarryRandom() * 0.24);
    const scale = shapes.get(key);
    vertices.setXYZ(i, vertices.getX(i) * scale, vertices.getY(i) * scale, vertices.getZ(i) * scale);
  }
  quarryGeometry.computeVertexNormals();
  const quarry = new THREE.Mesh(quarryGeometry, material('#85898d', { emissive: '#bac4cf', emissiveIntensity: 0 }));
  quarry.scale.set(layout.width, layout.height, layout.depth);
  quarry.position.set(layout.x, groundY + layout.height * 0.6, layout.z);
  quarry.rotation.y = layout.rotation;
  quarry.castShadow = true;
  group.add(quarry);
  const rockCount = 4 + Math.floor(random() * 3);
  const tuftCount = 7 + Math.floor(random() * 4);
  const rocks = new THREE.InstancedMesh(rockGeometry, stones, rockCount);
  const grasses = new THREE.InstancedMesh(grassGeometry, grass, tuftCount * 3);
  const ripples = new THREE.InstancedMesh(rippleGeometry, sandRidges, tuftCount);
  ripples.visible = false;
  rocks.castShadow = true;
  const occupied = [];
  const transform = new THREE.Object3D();
  // Bounded rejection sampling keeps decoration inside the hexagon and off planting slots.
  for (let attempt = 0; attempt < 600 && occupied.length < rockCount + tuftCount; attempt++) {
    const x = (random() - 0.5) * 4.2;
    const z = (random() - 0.5) * 4.2;
    if (Math.hypot(x, z) < 0.95
      || plantingSlots.some((slot) => Math.hypot(slot.x - x, slot.z - z) < 0.35)
      || Math.hypot(x - layout.x, z - layout.z) < quarryRadius + 0.22
      || occupied.some((point) => Math.hypot(point.x - x, point.z - z) < 0.3)) continue;
    const apothem = 2.67 * Math.cos(Math.PI / 6);
    if (Array.from({ length: 6 }, (_, side) => side * Math.PI / 3)
      .some((angle) => x * Math.cos(angle) + z * Math.sin(angle) > apothem - 0.22)) continue;
    const index = occupied.length;
    occupied.push({ x, z });
    if (index < rockCount) {
      const size = 0.075 + random() * 0.075;
      transform.position.set(x, groundY + size * 0.3, z);
      transform.scale.set(size * (1.1 + random() * 0.4), size * (0.45 + random() * 0.25), size);
      transform.rotation.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
      transform.updateMatrix();
      rocks.setMatrixAt(index, transform.matrix);
    } else {
      const heading = random() * Math.PI * 2;
      transform.position.set(x, groundY + 0.008, z);
      transform.scale.set(1, 0.6, 1);
      transform.rotation.set(-Math.PI / 2, 0, heading);
      transform.updateMatrix();
      ripples.setMatrixAt(index - rockCount, transform.matrix);
      for (let blade = 0; blade < 3; blade++) {
        const height = 0.1 + random() * 0.18;
        transform.position.set(x + Math.cos(heading) * (blade - 1) * 0.025, groundY + height * 0.44, z + Math.sin(heading) * (blade - 1) * 0.025);
        transform.scale.set(0.75 + random() * 0.5, height, 0.75 + random() * 0.5);
        transform.rotation.set(0, heading, (random() - 0.5) * 0.65);
        transform.updateMatrix();
        grasses.setMatrixAt((index - rockCount) * 3 + blade, transform.matrix);
      }
    }
  }
  rocks.count = Math.min(rockCount, occupied.length);
  grasses.count = Math.max(0, occupied.length - rockCount) * 3;
  ripples.count = Math.max(0, occupied.length - rockCount);
  ripples.instanceMatrix.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = grasses.instanceMatrix.needsUpdate = true;
  group.add(rocks, grasses, ripples);
  // Independent decoration stream preserves existing terrain layouts.
  const petalRandom = createRandom(terrainSeed({ q, r }) ^ 0x53414b55);
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, 72);
  let petalCount = 0;
  for (let attempt = 0; attempt < 500 && petalCount < 72; attempt++) {
    const angle = petalRandom() * Math.PI * 2;
    const radius = 0.65 + petalRandom() * 1.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (plantingSlots.some((slot) => Math.hypot(slot.x - x, slot.z - z) < 0.23)
      || Math.hypot(x - layout.x, z - layout.z) < quarryRadius + 0.18) continue;
    transform.position.set(x, groundY + 0.008, z);
    transform.rotation.set(0, petalRandom() * Math.PI * 2, 0);
    const size = 0.018 + petalRandom() * 0.018;
    transform.scale.set(size, 0.006, size * 1.6);
    transform.updateMatrix();
    petals.setMatrixAt(petalCount++, transform.matrix);
  }
  petals.count = petalCount;
  petals.instanceMatrix.needsUpdate = true;
  petals.visible = false;
  group.add(petals);
  const outlinePoints = Array.from({ length: 7 }, (_, i) => {
    const angle = Math.PI / 2 + i * Math.PI / 3;
    return new THREE.Vector3(Math.cos(angle) * 2.66, groundY + 0.018, Math.sin(angle) * 2.66);
  });
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), new THREE.LineBasicMaterial({ color: '#e5ecae' }));
  outline.visible = false;
  group.add(outline);
  return { group, quarry, ground, outline, setBiome(biome) {
    const conifer = biome === 'conifer';
    const savanna = biome === 'savanna';
    const desert = biome === 'desert';
    const blossom = biome === 'blossom';
    petals.visible = blossom;
    grasses.visible = !desert;
    ripples.visible = desert;
    stones.color.set(blossom ? '#777e80' : desert ? '#ba8768' : '#b1b4b2');
    earth.color.set(blossom ? '#897978' : desert ? '#c4a070' : savanna ? '#ad8050' : conifer ? '#716349' : '#a68563');
    turf.color.set(blossom ? '#98ad9e' : desert ? '#ecd39c' : savanna ? '#d3b473' : conifer ? '#657a55' : '#a8b782');
    grass.color.set(blossom ? '#668b77' : savanna ? '#b59a54' : conifer ? '#4d684b' : '#899e69');
    earth.color.offsetHSL(hueShift, 0, lightnessShift * 0.6);
    turf.color.offsetHSL(hueShift, 0, lightnessShift);
    grass.color.offsetHSL(hueShift, 0, lightnessShift * 0.8);
  } };
}
