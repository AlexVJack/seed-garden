import * as THREE from 'three';
import { createRandom } from './plants.js';
import { plantingSlots } from './garden-layout.js';

export const groundY = 0.26;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const soilGeometry = new THREE.CylinderGeometry(2.65, 2.25, 0.65, 6);
const groundGeometry = new THREE.CylinderGeometry(2.67, 2.65, 0.12, 6);
const grassGeometry = new THREE.ConeGeometry(0.025, 1, 3);
const rockMaterial = material('#c5c4ae');

export function makeTerrain({ hasQuarry = false } = {}) {
  const group = new THREE.Group();
  const earth = material('#a68563');
  const turf = material('#a8b782');
  const grass = material('#899e69');
  const soil = new THREE.Mesh(soilGeometry, earth);
  soil.position.y = -0.115;
  soil.castShadow = soil.receiveShadow = true;
  const ground = new THREE.Mesh(groundGeometry, turf);
  ground.position.y = groundY - 0.06;
  ground.receiveShadow = true;
  group.add(soil, ground);
  const random = createRandom(42);
  let quarry = null;
  for (let i = 0; i < 36; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.85 + random() * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (i !== 0 && (plantingSlots.some((slot) => Math.hypot(slot.x - x, slot.z - z) < 0.32)
      || Math.hypot(x - 1.55, z - 1.15) < 0.6)) continue;
    if (i % 4 === 0) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + random() * 0.08, 0), rockMaterial);
      rock.position.set(x, groundY + 0.04, z);
      rock.scale.set(1.3, 0.6, 1);
      rock.rotation.set(random(), random() * 6, random());
      rock.castShadow = true;
      if (i === 0) {
        if (!hasQuarry) continue;
        rock.material = material('#85898d', { emissive: '#bac4cf', emissiveIntensity: 0 });
        rock.scale.set(3.2, 2.6, 2.8);
        rock.position.set(1.55, groundY + 0.23, 1.15);
        quarry = rock;
      }
      group.add(rock);
    } else {
      for (let blade = 0; blade < 3; blade++) {
        const height = 0.15 + random() * 0.12;
        const tuft = new THREE.Mesh(grassGeometry, grass);
        tuft.scale.y = height;
        tuft.position.set(x + blade * 0.035, groundY + 0.07, z);
        tuft.rotation.z = (random() - 0.5) * 0.6;
        group.add(tuft);
      }
    }
  }
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
    earth.color.set(savanna ? '#ad8050' : conifer ? '#716349' : '#a68563');
    turf.color.set(savanna ? '#d3b473' : conifer ? '#657a55' : '#a8b782');
    grass.color.set(savanna ? '#b59a54' : conifer ? '#4d684b' : '#899e69');
  } };
}
