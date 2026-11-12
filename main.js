import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { announce, setUiState, translate } from './i18n.js';
import { createResources } from './resources.js';
import { plantCosts, plantingSlots, growthDuration, neighborOffsets } from './garden-layout.js';
import { makePlant } from './plants.js';
import { makeTree } from './trees.js';
import { makeTerrain, groundY } from './terrain.js';

const $ = (selector) => document.querySelector(selector);
let storage;
try { storage = window.localStorage; } catch { /* Keep playing without persistent storage. */ }
const resources = createResources(storage);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6f4ed');
scene.fog = new THREE.Fog('#f6f4ed', 40, 75);
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
camera.position.set(8, 6.2, 10);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('#scene').appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.8, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 32;
controls.minPolarAngle = 0.4;
controls.maxPolarAngle = Math.PI / 2.15;
scene.add(new THREE.HemisphereLight('#fffbeb', '#a3ad8d', 2.5));
const sunlight = new THREE.DirectionalLight('#fff3d5', 3.2);
sunlight.position.set(-3, 12, 5);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 35 });
sunlight.shadow.normalBias = 0.035;
sunlight.shadow.bias = -0.0002;
scene.add(sunlight);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#f6f4ed', roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.46;
floor.receiveShadow = true;
scene.add(floor);

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const isTree = (type) => type === 'apple' || type === 'pine';
const views = [];
let activeParcel = 0;
let selectedType = null;
let expansionVisible = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function buildTree(view, record) {
  if (view.tree) {
    view.root.remove(view.tree.group);
    view.tree.dispose();
  }
  view.treeRecord = record;
  view.tree = record ? makeTree(view.id === 0 ? 'apple' : 'pine', record.seed) : null;
  view.finished = false;
  view.restoredMature = Boolean(record && Date.now() - record.startedAt >= growthDuration);
  if (view.tree) {
    view.tree.group.position.set(record.x, groundY, record.z);
    view.root.add(view.tree.group);
  }
}

function refreshPlants(view) {
  view.plants.clear();
  resources.parcel(view.id).plants.forEach((plant) => {
    const slot = plantingSlots[plant.slot];
    const group = makePlant(plant.type, plant.seed, view.biome);
    group.position.set(slot.x, groundY, slot.z);
    view.plants.add(group);
  });
}

function createParcel(id) {
  const record = resources.parcel(id);
  const offset = id === 0 ? { x: 0, z: 0 } : neighborOffsets[record.direction];
  const root = new THREE.Group();
  root.position.set(offset.x, 0, offset.z);
  root.userData.parcelId = id;
  const terrain = makeTerrain();
  const plants = new THREE.Group();
  root.add(terrain.group, plants);
  scene.add(root);
  const view = { id, root, terrain, plants, biome: record.biome, tree: null, minedAt: -Infinity };
  terrain.setBiome(view.biome);
  views.push(view);
  refreshPlants(view);
  buildTree(view, record.tree);
  return view;
}
createParcel(0);
if (resources.second) createParcel(1);

const slotMarkers = new THREE.Group();
const slotGeometry = new THREE.RingGeometry(0.12, 0.17, 20);
const markerMaterial = new THREE.MeshBasicMaterial({ color: '#eef8bd', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
scene.add(slotMarkers);
const slotButtons = plantingSlots.map((slot, index) => {
  const mesh = new THREE.Mesh(slotGeometry, markerMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(slot.x, groundY + 0.015, slot.z);
  slotMarkers.add(mesh);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.slot = index;
  button.textContent = `${translate('slot')} ${index + 1}`;
  button.addEventListener('click', () => plantItem(index));
  $('#slot-choices').appendChild(button);
  return button;
});
const treeMarker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), markerMaterial);
treeMarker.rotation.x = -Math.PI / 2;
scene.add(treeMarker);

const expansionPreviews = new THREE.Group();
scene.add(expansionPreviews);
const previewGeometry = new THREE.CylinderGeometry(2.67, 2.67, 0.035, 6);
const previewMaterial = new THREE.MeshBasicMaterial({ color: '#8da582', transparent: true, opacity: 0.18, depthWrite: false });
const plusMaterial = new THREE.MeshBasicMaterial({ color: '#84937d', transparent: true, opacity: 0.8, depthWrite: false });
const plusGeometry = new THREE.BoxGeometry(0.6, 0.025, 0.1);
neighborOffsets.forEach((offset, direction) => {
  const group = new THREE.Group();
  group.position.set(offset.x, groundY, offset.z);
  group.userData.direction = direction;
  group.add(new THREE.Mesh(previewGeometry, previewMaterial));
  for (let i = 0; i < 2; i++) {
    const plus = new THREE.Mesh(plusGeometry, plusMaterial);
    plus.position.y = 0.035;
    plus.rotation.y = i * Math.PI / 2;
    group.add(plus);
  }
  expansionPreviews.add(group);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.neighbor = direction;
  button.textContent = `${translate('neighbor')} ${direction + 1}`;
  button.addEventListener('click', () => expandGarden(direction));
  $('#expansion-choices').appendChild(button);
});

function resize() {
  const { width, height } = $('#scene').getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  const mobile = width < 700;
  camera.fov = mobile ? 65 : 44;
  camera.setViewOffset(width, height, mobile ? 0 : -width * (expansionVisible || views.length > 1 ? 0.14 : 0.18), mobile ? -height * 0.09 : 0, width, height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function focusGarden(overview = false) {
  const center = overview && views.length > 1 ? views[1].root.position.clone().multiplyScalar(0.5) : views[activeParcel].root.position.clone();
  center.y = overview ? 0.9 : 1.5;
  if (overview && expansionVisible) center.set(0, 0.5, 0);
  const distance = overview ? (expansionVisible ? 25 : 19) : 13;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(8, 6.2, 10).normalize().multiplyScalar(distance));
  controls.update();
}

function updateUI() {
  const view = views[activeParcel];
  const record = resources.parcel(activeParcel);
  const occupied = new Set(record.plants.map((plant) => plant.slot));
  const full = occupied.size === plantingSlots.length;
  if (selectedType && !isTree(selectedType) && (full || resources.stone < plantCosts[selectedType])) selectedType = null;
  $('#stone-count').textContent = resources.stone;
  $('#stone-count').dataset.digits = String(resources.stone).length;
  $('#slots-used').textContent = `${occupied.size} / ${plantingSlots.length}`;
  document.querySelectorAll('[data-plant-type]').forEach((button) => {
    const type = button.dataset.plantType;
    button.disabled = full || resources.stone < plantCosts[type];
    button.setAttribute('aria-pressed', String(type === selectedType));
  });
  document.querySelectorAll('[data-tree-type]').forEach((button) => {
    const type = button.dataset.treeType;
    button.hidden = type === 'pine' && views.length < 2;
    button.disabled = Boolean(record.tree) || (type === 'apple' ? activeParcel !== 0 : activeParcel !== 1);
    button.setAttribute('aria-pressed', String(type === selectedType));
  });
  views.forEach((parcel) => {
    const biome = parcel.id === activeParcel && selectedType === 'pine' ? 'conifer' : resources.parcel(parcel.id).biome;
    if (parcel.biome !== biome) {
      parcel.biome = biome;
      parcel.terrain.setBiome(biome);
      refreshPlants(parcel);
    }
    parcel.terrain.outline.visible = views.length > 1 && parcel.id === activeParcel;
  });
  slotMarkers.position.copy(view.root.position);
  slotMarkers.visible = Boolean(selectedType && !isTree(selectedType));
  slotMarkers.children.forEach((mesh, index) => { mesh.visible = !occupied.has(index); });
  slotButtons.forEach((button, index) => { button.disabled = !selectedType || isTree(selectedType) || occupied.has(index); });
  $('#slot-choices').hidden = !selectedType || isTree(selectedType);
  treeMarker.visible = isTree(selectedType);
  treeMarker.position.copy(view.root.position).add(new THREE.Vector3(0, groundY + 0.02, 0));
  $('#plant').hidden = !isTree(selectedType);
  $('#cancel-planting').hidden = !selectedType;
  $('#planting-controls').hidden = !selectedType || !$('#shop-panel').hidden;
  $('#shop-toggle').classList.toggle('planting', Boolean(selectedType));
  $('#parcel-tabs').hidden = views.length < 2;
  document.querySelector('main').classList.toggle('expanded', views.length > 1);
  document.querySelectorAll('[data-parcel]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.parcel) === activeParcel)));
  const mature = Boolean(record.tree && Date.now() - record.tree.startedAt >= growthDuration);
  $('.growth-panel').hidden = !record.tree || mature;
  $('#reset').hidden = !record.tree;
  setUiState({ instruction: record.tree ? mature ? 'grown' : 'growing' : 'shopIdle',
    plantingStatus: isTree(selectedType) ? 'treeHint' : full ? 'gardenFull' : selectedType ? 'chooseSpot' : 'choosePlant',
    placement: isTree(selectedType) ? 'treeHint' : 'placePlant' });
  const progress = resources.expansionProgress();
  for (const [key, goal] of Object.entries({ stone: 500, bush: 3, mushroom: 6, flower: 8 })) {
    $(`#goal-${key}`).textContent = `${Math.min(progress[key], goal)} / ${goal}`;
  }
  $('#goal-tree').textContent = progress.tree ? '✓' : '—';
  $('#expansion-progress').hidden = views.length > 1;
  const ready = resources.canExpand();
  const newlyReady = ready && !expansionVisible;
  const changed = ready !== expansionVisible;
  expansionVisible = ready;
  expansionPreviews.visible = ready;
  $('#expansion-hint').hidden = !ready || Boolean(selectedType);
  $('#expansion-choices').hidden = !ready;
  if (changed) resize();
  if (newlyReady) { focusGarden(true); announce('expansionReady'); }
}

function setShopOpen(open) {
  const panel = $('#shop-panel');
  const toggle = $('#shop-toggle');
  const restoreFocus = !open && panel.contains(document.activeElement);
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.dataset.i18nAria = open ? 'closeShop' : 'openShop';
  toggle.setAttribute('aria-label', translate(toggle.dataset.i18nAria));
  $('#planting-controls').hidden = open || !selectedType;
  if (restoreFocus) toggle.focus({ preventScroll: true });
}
$('#shop-toggle').addEventListener('click', () => setShopOpen($('#shop-panel').hidden));
$('#close-shop').addEventListener('click', () => setShopOpen(false));

function selectType(type) {
  const record = resources.parcel(activeParcel);
  if (isTree(type) && (record.tree || (type === 'apple' ? activeParcel !== 0 : activeParcel !== 1))) return;
  selectedType = selectedType === type ? null : type;
  if (selectedType) {
    const target = views[activeParcel].root.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    camera.position.add(target.clone().sub(controls.target));
    controls.target.copy(target);
    controls.update();
  }
  updateUI();
  setShopOpen(false);
}
document.querySelectorAll('[data-plant-type], [data-tree-type]').forEach((button) => {
  button.addEventListener('click', () => selectType(button.dataset.plantType || button.dataset.treeType));
});
$('#cancel-planting').addEventListener('click', () => {
  selectedType = null;
  updateUI();
  $('#shop-toggle').focus({ preventScroll: true });
});

function selectParcel(id) {
  if (!views[id] || id === activeParcel) return;
  selectedType = null;
  activeParcel = id;
  updateUI();
  focusGarden();
}
document.querySelectorAll('[data-parcel]').forEach((button) => button.addEventListener('click', () => selectParcel(Number(button.dataset.parcel))));

function plantItem(slot) {
  if (!selectedType || isTree(selectedType)) return;
  if (!resources.plant(selectedType, slot, randomSeed(), activeParcel)) { updateUI(); return; }
  refreshPlants(views[activeParcel]);
  updateUI();
  announce('itemPlanted');
}

function plantTree(point = new THREE.Vector3()) {
  if (!isTree(selectedType)) return;
  const record = { x: point.x, z: point.z, seed: randomSeed(), startedAt: Date.now() };
  if (!resources.setTree(record, activeParcel)) return;
  selectedType = null;
  buildTree(views[activeParcel], record);
  updateUI();
  announce('planted');
}
$('#plant').addEventListener('click', () => plantTree());
$('#reset').addEventListener('click', () => {
  resources.setTree(null, activeParcel);
  buildTree(views[activeParcel], null);
  selectedType = null;
  updateUI();
  setShopOpen(true);
  $(`[data-tree-type="${activeParcel === 0 ? 'apple' : 'pine'}"]`).focus({ preventScroll: true });
});

function expandGarden(direction) {
  if (!resources.expand(direction)) { updateUI(); return; }
  selectedType = null;
  createParcel(1);
  activeParcel = 1;
  setShopOpen(false);
  updateUI();
  resize();
  focusGarden(true);
  announce('expanded');
}

function aimPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function pointerHit(event) {
  aimPointer(event);
  const hit = raycaster.intersectObjects(views.map((view) => view.root), true).find(({ object }) => {
    if (!object.isMesh) return false;
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
  });
  if (expansionVisible) {
    const preview = raycaster.intersectObjects(expansionPreviews.children, true)[0];
    if (preview && (!hit || preview.distance < hit.distance)) return { kind: 'expand', id: preview.object.parent.userData.direction };
  }
  if (!hit) return null;
  for (const view of views) if (hit.object === view.terrain.quarry) return { kind: 'quarry', id: view.id };
  let parent = hit.object;
  while (parent && parent.userData.parcelId === undefined) parent = parent.parent;
  return parent ? { kind: 'parcel', id: parent.userData.parcelId } : null;
}
function slotAtPointer(event) {
  if (!selectedType || isTree(selectedType)) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const occupied = new Set(resources.parcel(activeParcel).plants.map((plant) => plant.slot));
  let closest = null;
  let distance = event.pointerType === 'touch' ? 28 : 20;
  plantingSlots.forEach((slot, index) => {
    if (occupied.has(index)) return;
    const projected = new THREE.Vector3(slot.x, groundY, slot.z).add(views[activeParcel].root.position).project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    const x = rect.left + (projected.x + 1) * rect.width / 2;
    const y = rect.top + (1 - projected.y) * rect.height / 2;
    const d = Math.hypot(event.clientX - x, event.clientY - y);
    if (d < distance) { closest = index; distance = d; }
  });
  return closest;
}
function mineStone(id = activeParcel) {
  resources.mineStone();
  views[id].minedAt = performance.now();
  updateUI();
}
$('#mine-stone').addEventListener('click', () => mineStone());

// Pointer gestures must finish as taps: orbiting and pinching never spend or mine.
const gestures = new Map();
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  gestures.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false, hit: pointerHit(event) });
  if (gestures.size > 1) gestures.forEach((gesture) => { gesture.moved = true; });
});
renderer.domElement.addEventListener('pointermove', (event) => {
  const gesture = gestures.get(event.pointerId);
  if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture.moved = true;
  const hit = pointerHit(event);
  renderer.domElement.style.cursor = hit?.kind === 'quarry' || hit?.kind === 'expand' || slotAtPointer(event) !== null || isTree(selectedType) ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointercancel', (event) => gestures.delete(event.pointerId));
renderer.domElement.addEventListener('lostpointercapture', (event) => gestures.delete(event.pointerId));
renderer.domElement.addEventListener('pointerup', (event) => {
  const gesture = gestures.get(event.pointerId);
  gestures.delete(event.pointerId);
  if (!gesture || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) return;
  if (!$('#shop-panel').hidden) { setShopOpen(false); return; }
  const hit = pointerHit(event);
  if (hit?.kind === 'expand') {
    if (gesture.hit?.kind === 'expand' && gesture.hit.id === hit.id) expandGarden(hit.id);
    return;
  }
  if (hit?.kind === 'quarry') {
    if (gesture.hit?.kind === 'quarry' && gesture.hit.id === hit.id) mineStone(hit.id);
    return;
  }
  if (isTree(selectedType)) {
    aimPointer(event);
    const point = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (point) {
      point.sub(views[activeParcel].root.position);
      if (Math.hypot(point.x, point.z) <= 0.55) plantTree(point);
    }
    return;
  }
  const slot = slotAtPointer(event);
  if (slot !== null) { plantItem(slot); return; }
  if (hit?.kind === 'parcel') selectParcel(hit.id);
}, { capture: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    selectedType = null;
    setShopOpen(false);
    updateUI();
  }
});

resize();
updateUI();
if (views.length > 1) focusGarden(true);
renderer.setAnimationLoop((now) => {
  controls.update();
  let completed = false;
  for (const view of views) {
    view.terrain.quarry.material.emissiveIntensity = Math.max(0, 1 - (now - view.minedAt) / 220) * 0.65;
    if (!view.tree) continue;
    const progress = Math.max(0, Math.min((Date.now() - view.treeRecord.startedAt) / growthDuration, 1));
    if (!view.finished) {
      for (const piece of view.tree.pieces) {
        const fraction = Math.max(0, Math.min((progress - piece.birth) / piece.span, 1));
        piece.mesh.visible = fraction > 0;
        piece.mesh.scale.copy(piece.scale).multiplyScalar(fraction * fraction * (3 - 2 * fraction));
      }
    }
    if (!reducedMotion.matches) {
      view.tree.group.rotation.z = Math.sin(now * 0.0007) * 0.008 * progress;
      view.tree.group.rotation.x = Math.cos(now * 0.0005) * 0.005 * progress;
    }
    if (view.id === activeParcel) {
      $('#progress').value = progress;
      $('#progress-text').textContent = `${Math.round(progress * 100)}%`;
      setUiState({ growth: progress < 0.2 ? 'awakening' : progress < 0.55 ? 'reaching' : progress < 1 ? 'unfolding' : 'complete' });
    }
    if (progress === 1 && !view.finished) {
      view.finished = true;
      completed = true;
      if (!view.restoredMature) announce('finished');
    }
  }
  if (completed) updateUI();
  renderer.render(scene, camera);
});
