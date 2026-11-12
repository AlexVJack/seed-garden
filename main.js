import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { announce, setUiState, translate } from './i18n.js';
import { createResources } from './resources.js';
import { plantCosts, plantingSlots } from './garden-layout.js';
import { createRandom, makePlant } from './plants.js';

const $ = (selector) => document.querySelector(selector);
const container = $('#scene');
const seedButton = $('#seed');
let resourceStorage;
try { resourceStorage = window.localStorage; } catch { /* Storage may be unavailable. */ }
const resources = createResources(resourceStorage);
$('#stone-count').textContent = resources.stone;
const duration = 26;
const groundY = 0.26;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6f4ed');
scene.fog = new THREE.Fog('#f6f4ed', 18, 35);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
camera.position.set(8, 6.2, 10);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor('#f6f4ed');
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.8, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 18;
controls.minPolarAngle = 0.4;
controls.maxPolarAngle = Math.PI / 2.15;
scene.add(new THREE.HemisphereLight('#fffbeb', '#a3ad8d', 2.5));
const sunlight = new THREE.DirectionalLight('#fff3d5', 3.2);
sunlight.position.set(-3, 9, 5);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, { left: -7, right: 7, top: 8, bottom: -7, near: 0.5, far: 25 });
sunlight.shadow.normalBias = 0.035;
sunlight.shadow.bias = -0.0002;
scene.add(sunlight);

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const earth = material('#a68563');
const turf = material('#a8b782');
const stone = material('#c5c4ae');
const grass = material('#899e69');
const bark = material('#907052');
const leafMaterials = ['#8fa96b', '#a8bc7b', '#78955d', '#b8c88b', '#95ae73'].map((color) => material(color));
const island = new THREE.Group();
scene.add(island);
const soil = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.25, 0.65, 6), earth);
soil.position.y = -0.115;
soil.castShadow = soil.receiveShadow = true;
island.add(soil);
const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.67, 2.65, 0.12, 6), turf);
ground.position.y = groundY - 0.06;
ground.receiveShadow = true;
island.add(ground);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material('#f6f4ed'));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.46;
floor.receiveShadow = true;
scene.add(floor);

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
const decorRandom = createRandom(42);
let quarry;
for (let i = 0; i < 36; i++) {
  const angle = decorRandom() * Math.PI * 2;
  const radius = 1.85 + decorRandom() * 0.32;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (i !== 0 && (plantingSlots.some((slot) => Math.hypot(slot.x - x, slot.z - z) < 0.32)
    || Math.hypot(x - 1.55, z - 1.15) < 0.6)) continue;
  if (i % 4 === 0) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + decorRandom() * 0.08, 0), stone);
    rock.position.set(x, groundY + 0.04, z);
    rock.scale.set(1.3, 0.6, 1);
    rock.rotation.set(decorRandom(), decorRandom() * 6, decorRandom());
    rock.castShadow = true;
    if (i === 0) {
      rock.material = material('#85898d', { emissive: '#bac4cf', emissiveIntensity: 0 });
      rock.scale.set(3.2, 2.6, 2.8);
      rock.position.set(1.55, groundY + 0.23, 1.15);
      quarry = rock;
    }
    island.add(rock);
  } else {
    for (let blade = 0; blade < 3; blade++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.15 + decorRandom() * 0.12, 3), grass);
      tuft.position.set(x + blade * 0.035, groundY + 0.07, z);
      tuft.rotation.z = (decorRandom() - 0.5) * 0.6;
      island.add(tuft);
    }
  }
}

const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.17, 0.21, 40),
  new THREE.MeshBasicMaterial({ color: '#f8ffdc', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = groundY + 0.012;
marker.visible = false;
scene.add(marker);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
function aimPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function plantingPoint(event) {
  aimPointer(event);
  const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  // Keep the growing crown inside the diorama and away from its edge.
  return point && Math.hypot(point.x, point.z) <= 0.55 ? point : null;
}

let tree = null;
let pieces = [];
let plantedAt = null;
let armed = false;
let drag = null;
let finished = false;
let minedAt = -Infinity;
let selectedPlant = null;
const plantedItems = new THREE.Group();
scene.add(plantedItems);
const slotMarkers = new THREE.Group();
scene.add(slotMarkers);
const slotGeometry = new THREE.RingGeometry(0.12, 0.17, 20);
const slotMaterial = new THREE.MeshBasicMaterial({ color: '#eef8bd', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const slotButtons = plantingSlots.map((slot, index) => {
  const mesh = new THREE.Mesh(slotGeometry, slotMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(slot.x, groundY + 0.015, slot.z);
  slotMarkers.add(mesh);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.slot = index;
  button.textContent = `${translate('slot')} ${index + 1}`;
  button.addEventListener('click', () => plantItem(index));
  $('#slot-choices').append(button);
  return button;
});

function showPlant(plant) {
  const slot = plantingSlots[plant.slot];
  const group = makePlant(plant.type, plant.seed);
  group.position.set(slot.x, groundY, slot.z);
  plantedItems.add(group);
}
resources.plants.forEach(showPlant);

function updateShop() {
  const plants = resources.plants;
  const occupied = new Set(plants.map((plant) => plant.slot));
  const full = occupied.size === plantingSlots.length;
  if (selectedPlant && (full || resources.stone < plantCosts[selectedPlant])) selectedPlant = null;
  $('#stone-count').textContent = resources.stone;
  $('#slots-used').textContent = `${occupied.size} / ${plantingSlots.length}`;
  document.querySelectorAll('[data-plant-type]').forEach((button) => {
    const type = button.dataset.plantType;
    button.disabled = full || resources.stone < plantCosts[type];
    button.setAttribute('aria-pressed', String(type === selectedPlant));
  });
  slotMarkers.visible = Boolean(selectedPlant);
  slotMarkers.children.forEach((mesh, index) => { mesh.visible = !occupied.has(index); });
  slotButtons.forEach((button, index) => { button.disabled = !selectedPlant || occupied.has(index); });
  $('#cancel-planting').hidden = !selectedPlant;
  $('#slot-choices').hidden = !selectedPlant;
  $('.seed-tray').hidden = Boolean(selectedPlant) || plantedAt !== null;
  setUiState({ plantingStatus: full ? 'gardenFull' : selectedPlant ? 'chooseSpot' : resources.stone < 1 ? 'needStone' : 'choosePlant' });
}

function selectPlant(type) {
  selectedPlant = selectedPlant === type ? null : type;
  armed = false;
  marker.visible = false;
  seedButton.classList.remove('selected');
  setUiState({ hint: 'hint' });
  if (selectedPlant) {
    // Aim at the ground while placing small plants, preserving the camera distance.
    const shift = new THREE.Vector3(0, 0.5, 0).sub(controls.target);
    camera.position.add(shift);
    controls.target.add(shift);
    controls.update();
  }
  updateShop();
}
document.querySelectorAll('[data-plant-type]').forEach((button) => {
  button.addEventListener('click', () => selectPlant(button.dataset.plantType));
});
$('#cancel-planting').addEventListener('click', () => { selectedPlant = null; updateShop(); });

function plantItem(slot) {
  if (!selectedPlant) return;
  const type = selectedPlant;
  const seed = randomSeed();
  if (!resources.plant(type, slot, seed)) { updateShop(); return; }
  showPlant({ type, slot, seed });
  updateShop();
  announce('itemPlanted');
}

function slotAtPointer(event) {
  if (!selectedPlant) return null;
  // Compare projected centers, so hit areas stay finger-sized at any zoom level.
  const rect = renderer.domElement.getBoundingClientRect();
  const occupied = new Set(resources.plants.map((plant) => plant.slot));
  let closest = null;
  let distance = event.pointerType === 'touch' ? 28 : 20;
  plantingSlots.forEach((slot, index) => {
    if (occupied.has(index)) return;
    const projected = new THREE.Vector3(slot.x, groundY, slot.z).project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    const x = rect.left + (projected.x + 1) * rect.width / 2;
    const y = rect.top + (1 - projected.y) * rect.height / 2;
    const d = Math.hypot(event.clientX - x, event.clientY - y);
    if (d < distance) { closest = index; distance = d; }
  });
  return closest;
}

function pointsAtQuarry(event) {
  aimPointer(event);
  const hit = raycaster.intersectObjects(tree ? [island, plantedItems, tree] : [island, plantedItems], true)[0];
  return hit?.object === quarry;
}
function mineStone() {
  $('#stone-count').textContent = resources.mineStone();
  minedAt = performance.now();
  updateShop();
}
$('#mine-stone').addEventListener('click', mineStone);
const leafGeometry = new THREE.IcosahedronGeometry(0.38, 0);
const up = new THREE.Vector3(0, 1, 0);
const smooth = (value) => value * value * (3 - 2 * value);

function makeTree(point, seed) {
  const random = createRandom(seed);
  tree = new THREE.Group();
  tree.position.copy(point);
  scene.add(tree);
  pieces = [];

  function foliage(tip, birth, size) {
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterials[Math.floor(random() * leafMaterials.length)]);
      leaf.position.copy(tip).add(new THREE.Vector3((random() - 0.5) * 0.6, (random() - 0.25) * 0.5, (random() - 0.5) * 0.6));
      leaf.rotation.set(random() * 3, random() * 3, random() * 3);
      leaf.castShadow = true;
      tree.add(leaf);
      pieces.push({ mesh: leaf, birth: birth + random() * 0.035, span: 0.14, scale: new THREE.Vector3(size * 1.2, size * 0.85, size) });
      leaf.scale.setScalar(0);
    }
  }

  function branch(origin, direction, length, radius, level, birth, span) {
    const segments = 5;
    let position = origin.clone();
    let heading = direction.clone().normalize();
    const step = length / segments;
    for (let i = 0; i < segments; i++) {
      heading.add(new THREE.Vector3((random() - 0.5) * 0.16, 0.035, (random() - 0.5) * 0.16)).normalize();
      const bottomRadius = radius * (1 - i / segments * 0.55);
      const topRadius = radius * (1 - (i + 1) / segments * 0.55);
      const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, step, 7);
      geometry.translate(0, step / 2, 0);
      const mesh = new THREE.Mesh(geometry, bark);
      mesh.position.copy(position);
      mesh.quaternion.setFromUnitVectors(up, heading);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.scale.setScalar(0);
      tree.add(mesh);
      pieces.push({ mesh, birth: birth + span * i / segments, span: span / segments, scale: new THREE.Vector3(1, 1, 1) });
      position.addScaledVector(heading, step);

      if (level < 3 && (i === 2 || i === 4)) {
        const count = level === 0 ? 3 : 2;
        const baseAngle = random() * Math.PI * 2;
        for (let child = 0; child < count; child++) {
          const angle = baseAngle + child * Math.PI * 2 / count + random() * 0.4;
          const outward = new THREE.Vector3(Math.cos(angle), 0.55 + random() * 0.5, Math.sin(angle));
          const childDirection = heading.clone().multiplyScalar(0.35).add(outward).normalize();
          branch(position, childDirection, length * (0.53 + random() * 0.13), bottomRadius * 0.48, level + 1,
            birth + span * (i + 1) / segments, span * 0.65);
        }
      }
    }
    if (level >= 2) foliage(position, birth + span, level === 3 ? 0.9 + random() * 0.35 : 1.1);
  }
  branch(new THREE.Vector3(), new THREE.Vector3((random() - 0.5) * 0.08, 1, (random() - 0.5) * 0.08), 2.65 + random() * 0.35, 0.17, 0, 0.025, 0.37);
  // Normalize timings so the last leaves finish at exactly 100%.
  const end = Math.max(...pieces.map((piece) => piece.birth + piece.span));
  for (const piece of pieces) {
    piece.birth /= end;
    piece.span /= end;
  }
}

function plant(point, saved = null) {
  if (plantedAt !== null) return;
  selectedPlant = null;
  updateShop();
  armed = false;
  marker.visible = false;
  seedButton.classList.remove('selected');
  $('.seed-tray').hidden = true;
  const record = saved || { x: point.x, z: point.z, seed: randomSeed(), startedAt: Date.now() };
  if (!saved) resources.setTree(record);
  const elapsed = Math.max(0, Date.now() - record.startedAt);
  $('.growth-panel').hidden = elapsed >= duration * 1000;
  $('#reset').hidden = false;
  setUiState({ instruction: elapsed >= duration * 1000 ? 'grown' : 'growing', hint: 'hint' });
  makeTree(point, record.seed);
  plantedAt = record.startedAt;
  finished = elapsed >= duration * 1000;
  if (!saved) announce('planted');
}

function armSeed() {
  if (plantedAt !== null) return;
  selectedPlant = null;
  updateShop();
  armed = !armed;
  seedButton.classList.toggle('selected', armed);
  setUiState({ hint: armed ? 'armedHint' : 'hint' });
  announce(armed ? 'pickedUp' : 'putBack');
}

seedButton.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || plantedAt !== null) return;
  event.preventDefault();
  controls.enabled = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  seedButton.setPointerCapture(event.pointerId);
});
seedButton.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true;
  if (!drag.moved) return;
  // Move the button outside the transformed tray so viewport coordinates stay correct.
  if (!seedButton.classList.contains('dragging')) {
    document.body.appendChild(seedButton);
    seedButton.classList.add('dragging');
    seedButton.setPointerCapture(event.pointerId);
  }
  seedButton.style.left = `${event.clientX - 32}px`;
  seedButton.style.top = `${event.clientY - 32}px`;
  const point = plantingPoint(event);
  marker.visible = Boolean(point);
  if (point) marker.position.set(point.x, groundY + 0.012, point.z);
});
function endDrag(event, cancelled = false) {
  if (!drag || drag.id !== event.pointerId) return;
  const wasMoved = drag.moved;
  const point = !cancelled && wasMoved ? plantingPoint(event) : null;
  drag = null;
  controls.enabled = true;
  marker.visible = false;
  seedButton.classList.remove('dragging');
  seedButton.style.removeProperty('left');
  seedButton.style.removeProperty('top');
  $('.seed-tray').prepend(seedButton);
  if (seedButton.hasPointerCapture(event.pointerId)) seedButton.releasePointerCapture(event.pointerId);
  if (point) plant(point);
  else if (!wasMoved && !cancelled) armSeed();
  else if (!cancelled) announce('invalidSpot');
}
seedButton.addEventListener('pointerup', (event) => endDrag(event));
seedButton.addEventListener('pointercancel', (event) => endDrag(event, true));
seedButton.addEventListener('click', (event) => { if (event.detail === 0) armSeed(); });
$('#plant').addEventListener('click', () => plant(new THREE.Vector3(0, groundY, 0)));
renderer.domElement.addEventListener('pointermove', (event) => {
  const gesture = scenePointers.get(event.pointerId);
  if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture.moved = true;
  renderer.domElement.style.cursor = !drag && (pointsAtQuarry(event) || slotAtPointer(event) !== null) ? 'pointer' : '';
  if (!armed) return;
  const point = plantingPoint(event);
  marker.visible = Boolean(point);
  if (point) marker.position.set(point.x, groundY + 0.012, point.z);
});
renderer.domElement.addEventListener('pointerleave', () => { if (!drag) marker.visible = false; });
// Distinguish a tap from orbiting, including multi-touch and cancelled gestures.
const scenePointers = new Map();
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  scenePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false, quarry: pointsAtQuarry(event) });
  if (scenePointers.size > 1) scenePointers.forEach((gesture) => { gesture.moved = true; });
});
renderer.domElement.addEventListener('pointercancel', (event) => scenePointers.delete(event.pointerId));
renderer.domElement.addEventListener('lostpointercapture', (event) => scenePointers.delete(event.pointerId));
renderer.domElement.addEventListener('pointerup', (event) => {
  const gesture = scenePointers.get(event.pointerId);
  scenePointers.delete(event.pointerId);
  if (!gesture || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) return;
  if (pointsAtQuarry(event)) {
    if (gesture.quarry) mineStone();
    return;
  }
  if (selectedPlant) {
    const slot = slotAtPointer(event);
    if (slot !== null) plantItem(slot);
    return;
  }
  if (!armed) return;
  const point = plantingPoint(event);
  if (point) plant(point);
}, { capture: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    armed = false;
    marker.visible = false;
    seedButton.classList.remove('selected');
    setUiState({ hint: 'hint' });
    selectedPlant = null;
    updateShop();
  }
});
$('#reset').addEventListener('click', () => {
  if (tree) {
    scene.remove(tree);
    tree.traverse((object) => {
      if (object.isMesh && object.geometry !== leafGeometry) object.geometry.dispose();
    });
  }
  tree = null;
  pieces = [];
  plantedAt = null;
  finished = false;
  resources.setTree(null);
  selectedPlant = null;
  updateShop();
  $('.seed-tray').hidden = false;
  $('.growth-panel').hidden = true;
  $('#reset').hidden = true;
  $('#progress').value = 0;
  $('#progress-text').textContent = '0%';
  setUiState({ growth: 'awakening', hint: 'hint', instruction: 'idle' });
  announce('ready');
  $('#plant').focus();
});

function resize() {
  const { width, height } = container.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  const mobile = width < 700;
  camera.fov = mobile ? 65 : 44;
  // Reserve space for the heading; keep the whole mature crown in view.
  camera.setViewOffset(width, height, mobile ? 0 : -width * 0.18, mobile ? -height * 0.09 : 0, width, height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
updateShop();
const savedTree = resources.tree;
if (savedTree) plant(new THREE.Vector3(savedTree.x, groundY, savedTree.z), savedTree);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
renderer.setAnimationLoop((now) => {
  controls.update();
  quarry.material.emissiveIntensity = Math.max(0, 1 - (now - minedAt) / 220) * 0.65;
  if (plantedAt !== null) {
    const progress = Math.max(0, Math.min((Date.now() - plantedAt) / (duration * 1000), 1));
    for (const piece of pieces) {
      const fraction = Math.max(0, Math.min((progress - piece.birth) / piece.span, 1));
      piece.mesh.visible = fraction > 0;
      piece.mesh.scale.copy(piece.scale).multiplyScalar(smooth(fraction));
    }
    if (!reducedMotion.matches) {
      tree.rotation.z = Math.sin(now * 0.0007) * 0.008 * progress;
      tree.rotation.x = Math.cos(now * 0.0005) * 0.005 * progress;
    }
    $('#progress').value = progress;
    $('#progress-text').textContent = `${Math.round(progress * 100)}%`;
    setUiState({ growth: progress < 0.2 ? 'awakening' : progress < 0.55 ? 'reaching' : progress < 1 ? 'unfolding' : 'complete' });
    if (progress === 1 && !finished) {
      finished = true;
      $('.growth-panel').hidden = true;
      setUiState({ instruction: 'grown' });
      announce('finished');
    }
  }
  renderer.render(scene, camera);
});
