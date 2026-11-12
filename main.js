import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { announce, setUiState, translate } from './i18n.js';
import { createResources } from './resources.js';
import { plantCosts, plantingSlots, growthDuration, expansionCost, parcelLimit, parcelPosition, canPlantTree } from './garden-layout.js';
import { makePlant } from './plants.js';
import { makeTree } from './trees.js';
import { makeTerrain, groundY } from './terrain.js';

const $ = (selector) => document.querySelector(selector);
let storage;
try { storage = window.localStorage; } catch { /* Keep playing without persistent storage. */ }
const resources = createResources(storage);
$('#new-game').addEventListener('click', () => {
  if (!window.confirm(translate('confirmNewGame'))) return;
  resources.newGame();
  window.location.reload();
});
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6f4ed');
scene.fog = new THREE.Fog('#f6f4ed', 300, 550);
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);
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
controls.maxDistance = 300;
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
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#f6f4ed', roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.46;
floor.receiveShadow = true;
scene.add(floor);

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const isTree = (type) => type === 'apple' || type === 'pine';
const views = [];
let activeParcel = 0;
let selectedType = null;
let shearsActive = false;
let expansionVisible = false;
let overviewActive = false;
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
  view.tree = record ? makeTree(resources.parcel(view.id).treeType, record.seed) : null;
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
    group.userData.plantSlot = plant.slot;
    group.position.set(slot.x, groundY, slot.z);
    view.plants.add(group);
  });
}

function createParcel(id) {
  const record = resources.parcel(id);
  const offset = parcelPosition(record);
  const root = new THREE.Group();
  root.position.set(offset.x, 0, offset.z);
  root.userData.parcelId = id;
  const terrain = makeTerrain({ hasQuarry: id === 0 });
  const plants = new THREE.Group();
  root.add(terrain.group, plants);
  scene.add(root);
  const view = { id, root, terrain, plants, biome: record.biome, tree: null, minedAt: -Infinity };
  terrain.setBiome(view.biome);
  views.push(view);
  refreshPlants(view);
  buildTree(view, record.tree);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.parcel = id;
  button.textContent = `${translate('parcel')} ${id + 1}`;
  button.addEventListener('click', () => selectParcel(id));
  $('#parcel-list').appendChild(button);
  return view;
}
resources.parcels.forEach((_, id) => createParcel(id));

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
  button.addEventListener('click', () => shearsActive ? removePlant(index) : plantItem(index));
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
let expansionPositions = [];
function refreshExpansionPreviews() {
  expansionPreviews.clear();
  $('#expansion-choices').replaceChildren();
  expansionPositions = resources.expansionTargets();
  expansionPositions.forEach((position, index) => {
    const offset = parcelPosition(position);
    const group = new THREE.Group();
    group.position.set(offset.x, groundY, offset.z);
    group.userData.targetIndex = index;
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
    button.dataset.neighbor = index;
    button.textContent = `${translate('neighbor')} ${index + 1}`;
    button.addEventListener('click', () => expandGarden(index));
    $('#expansion-choices').appendChild(button);
  });
}
refreshExpansionPreviews();

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
window.addEventListener('resize', () => { if (overviewActive) focusGarden(true); });

function focusGarden(overview = false) {
  overviewActive = overview;
  const bounds = new THREE.Box3();
  views.forEach((view) => {
    bounds.expandByPoint(view.root.position.clone().add(new THREE.Vector3(-3, 0, -3)));
    bounds.expandByPoint(view.root.position.clone().add(new THREE.Vector3(3, 5, 3)));
  });
  if (overview && expansionVisible) expansionPreviews.children.forEach((preview) => {
    bounds.expandByPoint(preview.position.clone().add(new THREE.Vector3(-3, 0, -3)));
    bounds.expandByPoint(preview.position.clone().add(new THREE.Vector3(3, 0, 3)));
  });
  const center = overview ? bounds.getCenter(new THREE.Vector3()) : views[activeParcel].root.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const distance = overview ? Math.max(13, radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.2) : 13;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(8, 6.2, 10).normalize().multiplyScalar(distance));
  const lightCenter = bounds.getCenter(new THREE.Vector3());
  sunlight.target.position.copy(lightCenter);
  sunlight.position.copy(lightCenter).add(new THREE.Vector3(-8, 30, 12));
  scene.add(sunlight.target);
  const shadowSize = Math.max(12, radius);
  Object.assign(sunlight.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, far: shadowSize * 2 + 70 });
  sunlight.shadow.camera.updateProjectionMatrix();
  controls.update();
}
$('#garden-overview').addEventListener('click', () => focusGarden(true));

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
    button.disabled = Boolean(record.tree) || !canPlantTree(type, activeParcel);
    button.setAttribute('aria-pressed', String(type === selectedType));
  });
  views.forEach((parcel) => {
    const biome = parcel.id === activeParcel && isTree(selectedType) ? selectedType === 'pine' ? 'conifer' : 'meadow' : resources.parcel(parcel.id).biome;
    if (parcel.biome !== biome) {
      parcel.biome = biome;
      parcel.terrain.setBiome(biome);
      refreshPlants(parcel);
    }
    parcel.terrain.outline.visible = views.length > 1 && parcel.id === activeParcel;
  });
  slotMarkers.position.copy(view.root.position);
  slotMarkers.visible = shearsActive || Boolean(selectedType && !isTree(selectedType));
  slotMarkers.children.forEach((mesh, index) => { mesh.visible = shearsActive ? occupied.has(index) : !occupied.has(index); });
  slotButtons.forEach((button, index) => {
    button.disabled = shearsActive ? !occupied.has(index) : !selectedType || isTree(selectedType) || occupied.has(index);
    button.dataset.removing = String(shearsActive);
    button.textContent = `${translate(shearsActive ? 'removeSlot' : 'slot')} ${index + 1}`;
  });
  $('#slot-choices').hidden = !shearsActive && (!selectedType || isTree(selectedType));
  treeMarker.visible = isTree(selectedType);
  treeMarker.position.copy(view.root.position).add(new THREE.Vector3(0, groundY + 0.02, 0));
  $('#plant').hidden = !isTree(selectedType);
  $('#cancel-planting').hidden = !selectedType && !shearsActive;
  $('#planting-controls').hidden = (!selectedType && !shearsActive) || !$('#shop-panel').hidden;
  $('#shears-toggle').setAttribute('aria-pressed', String(shearsActive));
  $('#shop-toggle').classList.toggle('planting', Boolean(selectedType));
  $('#parcel-tabs').hidden = views.length < 2;
  $('#parcel-count').textContent = `${views.length} / ${parcelLimit}`;
  document.querySelector('main').classList.toggle('expanded', views.length > 1);
  document.querySelectorAll('[data-parcel]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.parcel) === activeParcel)));
  $(`[data-parcel="${activeParcel}"]`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const mature = Boolean(record.tree && Date.now() - record.tree.startedAt >= growthDuration);
  $('.growth-panel').hidden = !record.tree || mature;
  setUiState({ instruction: record.tree ? mature ? 'grown' : 'growing' : 'shopIdle',
    plantingStatus: isTree(selectedType) ? 'treeHint' : full ? 'gardenFull' : selectedType ? 'chooseSpot' : 'choosePlant',
    placement: shearsActive ? 'shearsHint' : isTree(selectedType) ? 'treeHint' : 'placePlant' });
  const progress = resources.expansionProgress();
  for (const [key, goal] of Object.entries({ stone: expansionCost, bush: 3, mushroom: 6, flower: 8 })) {
    $(`#goal-${key}`).textContent = `${Math.min(progress[key], goal)} / ${goal}`;
  }
  $('#goal-tree').textContent = progress.tree ? '✓' : '—';
  $('#expansion-progress').hidden = views.length >= parcelLimit;
  $('#parcel-limit').hidden = views.length < parcelLimit;
  $('#expansion-source').textContent = `${translate('parcel')} ${progress.parcelId + 1}`;
  $('#expansion-source').dataset.sourceParcel = progress.parcelId;
  const ready = resources.canExpand();
  const newlyReady = ready && !expansionVisible;
  const changed = ready !== expansionVisible;
  expansionVisible = ready;
  expansionPreviews.visible = ready;
  $('#expansion-hint').hidden = !ready || Boolean(selectedType) || shearsActive;
  $('#expansion-choices').hidden = !ready;
  if (changed) resize();
  if (newlyReady) { focusGarden(true); announce('expansionReady'); }
}

function setShopOpen(open) {
  if (open && shearsActive) {
    shearsActive = false;
    updateUI();
  }
  const panel = $('#shop-panel');
  const toggle = $('#shop-toggle');
  const restoreFocus = !open && panel.contains(document.activeElement);
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.dataset.i18nAria = open ? 'closeShop' : 'openShop';
  toggle.setAttribute('aria-label', translate(toggle.dataset.i18nAria));
  $('#planting-controls').hidden = open || (!selectedType && !shearsActive);
  if (restoreFocus) toggle.focus({ preventScroll: true });
}
$('#shop-toggle').addEventListener('click', () => setShopOpen($('#shop-panel').hidden));
$('#close-shop').addEventListener('click', () => setShopOpen(false));
$('#shears-toggle').addEventListener('click', () => {
  shearsActive = !shearsActive;
  selectedType = null;
  setShopOpen(false);
  updateUI();
  if (shearsActive) announce('shearsHint');
});

function selectType(type) {
  shearsActive = false;
  const record = resources.parcel(activeParcel);
  if (isTree(type) && (record.tree || !canPlantTree(type, activeParcel))) return;
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
  shearsActive = false;
  selectedType = null;
  updateUI();
  $('#shop-toggle').focus({ preventScroll: true });
});

function selectParcel(id) {
  if (!views[id]) return;
  selectedType = null;
  activeParcel = id;
  updateUI();
  focusGarden();
}

function plantItem(slot) {
  if (!selectedType || isTree(selectedType)) return;
  if (!resources.plant(selectedType, slot, randomSeed(), activeParcel)) { updateUI(); return; }
  refreshPlants(views[activeParcel]);
  updateUI();
  announce('itemPlanted');
}

function removePlant(slot, parcelId = activeParcel) {
  if (!shearsActive || !resources.removePlant(slot, parcelId)) return;
  refreshPlants(views[parcelId]);
  updateUI();
  announce('plantRemoved');
}

function plantTree(point = new THREE.Vector3()) {
  if (!isTree(selectedType)) return;
  const record = { x: point.x, z: point.z, seed: randomSeed(), startedAt: Date.now() };
  if (!resources.setTree(record, activeParcel, selectedType)) return;
  selectedType = null;
  buildTree(views[activeParcel], record);
  updateUI();
  announce('planted');
}
$('#plant').addEventListener('click', () => plantTree());

function expandGarden(index) {
  if (!resources.expand(expansionPositions[index])) { updateUI(); return; }
  selectedType = null;
  shearsActive = false;
  activeParcel = views.length;
  createParcel(activeParcel);
  refreshExpansionPreviews();
  setShopOpen(false);
  updateUI();
  resize();
  focusGarden();
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
    if (preview && (!hit || preview.distance < hit.distance)) return { kind: 'expand', id: preview.object.parent.userData.targetIndex };
  }
  if (!hit) return null;
  for (const view of views) if (hit.object === view.terrain.quarry) return { kind: 'quarry', id: view.id };
  let parent = hit.object;
  let plantSlot;
  for (let object = hit.object; object; object = object.parent) {
    if (object.userData.plantSlot !== undefined) plantSlot = object.userData.plantSlot;
  }
  while (parent && parent.userData.parcelId === undefined) parent = parent.parent;
  if (shearsActive && parent && plantSlot !== undefined) return { kind: 'plant', id: parent.userData.parcelId, slot: plantSlot };
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
function mineStone() {
  resources.mineStone();
  views[0].minedAt = performance.now();
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
  renderer.domElement.style.cursor = shearsActive ? hit?.kind === 'plant' ? 'crosshair' : '' : hit?.kind === 'quarry' || hit?.kind === 'expand' || slotAtPointer(event) !== null || isTree(selectedType) ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointercancel', (event) => gestures.delete(event.pointerId));
renderer.domElement.addEventListener('lostpointercapture', (event) => gestures.delete(event.pointerId));
renderer.domElement.addEventListener('pointerup', (event) => {
  const gesture = gestures.get(event.pointerId);
  gestures.delete(event.pointerId);
  if (!gesture || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) return;
  if (!$('#shop-panel').hidden) { setShopOpen(false); return; }
  const hit = pointerHit(event);
  if (shearsActive) {
    if (hit?.kind === 'plant' && gesture.hit?.kind === 'plant' && gesture.hit.id === hit.id && gesture.hit.slot === hit.slot) {
      removePlant(hit.slot, hit.id);
    } else if (hit?.kind === 'parcel') selectParcel(hit.id);
    return;
  }
  if (hit?.kind === 'expand') {
    if (gesture.hit?.kind === 'expand' && gesture.hit.id === hit.id) expandGarden(hit.id);
    return;
  }
  if (hit?.kind === 'quarry') {
    if (gesture.hit?.kind === 'quarry' && gesture.hit.id === hit.id) mineStone();
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
    shearsActive = false;
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
    if (view.terrain.quarry) {
      view.terrain.quarry.material.emissiveIntensity = Math.max(0, 1 - (now - view.minedAt) / 220) * 0.65;
    }
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
      view.tree.finish();
      view.finished = true;
      completed = true;
      if (!view.restoredMature) announce('finished');
    }
  }
  if (completed) updateUI();
  renderer.render(scene, camera);
});
