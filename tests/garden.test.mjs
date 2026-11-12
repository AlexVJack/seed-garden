import test from 'node:test';
import assert from 'node:assert/strict';
import { createResources, stoneLimit } from '../resources.js';
import { plantingSlots, growthDuration, expansionCost, hexDirections, parcelLimit, parcelPosition, hexKey, treeKind } from '../garden-layout.js';

function storage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
}

test('24 distinct places fit the hexagon, clear of the quarry and central tree', () => {
  assert.equal(plantingSlots.length, 24);
  const apothem = 2.67 * Math.cos(Math.PI / 6);
  plantingSlots.forEach((slot, index) => {
    assert.ok(Math.hypot(slot.x, slot.z) >= 1);
    assert.ok(Math.hypot(slot.x - 1.55, slot.z - 1.15) > 0.68);
    for (let side = 0; side < 6; side++) {
      const angle = side * Math.PI / 3;
      assert.ok(slot.x * Math.cos(angle) + slot.z * Math.sin(angle) + 0.26 < apothem);
    }
    plantingSlots.slice(index + 1).forEach((other) => {
      assert.ok(Math.hypot(slot.x - other.x, slot.z - other.z) > 0.5);
    });
  });
});

test('old stone saves migrate, with correct prices and persistent plants', () => {
  const saved = storage('{"stone":10}');
  const garden = createResources(saved);
  assert.equal(garden.plant('flower', 0, 42), true);
  assert.equal(garden.stone, 9);
  assert.equal(garden.plant('mushroom', 1, 43), true);
  assert.equal(garden.stone, 7);
  assert.equal(garden.plant('bush', 2, 44), true);
  assert.equal(garden.stone, 4);
  const restored = createResources(saved);
  assert.equal(restored.stone, 4);
  assert.deepEqual(restored.plants, garden.plants);
});

test('invalid, duplicate and unaffordable purchases never spend stone', () => {
  const garden = createResources(storage('{"stone":2}'));
  for (const args of [['bush', 0, 1], ['bad', 0, 1], ['flower', -1, 1], ['flower', 24, 1], ['flower', 0, -1]]) {
    assert.equal(garden.plant(...args), false);
    assert.equal(garden.stone, 2);
  }
  assert.equal(garden.plant('flower', 0, 1), true);
  assert.equal(garden.plant('flower', 0, 2), false);
  assert.equal(garden.stone, 1);
});

test('shears remove each plant type persistently without refunding stone, freeing its place', () => {
  for (const type of ['flower', 'bush', 'mushroom']) {
    const saved = storage('{"stone":10}');
    const garden = createResources(saved);
    const tree = { x: 0, z: 0, seed: 42, startedAt: 1000 };
    garden.setTree(tree);
    garden.plant(type, 0, 1);
    const balance = garden.stone;
    assert.equal(garden.removePlant(0), true);
    const restored = createResources(saved);
    assert.deepEqual(restored.plants, []);
    assert.deepEqual(restored.tree, tree);
    assert.equal(restored.stone, balance);
    assert.equal(restored.plant('flower', 0, 2), true);
  }
});

test('invalid removals do not change the garden', () => {
  const garden = createResources(storage('{"stone":10}'));
  garden.plant('flower', 0, 1);
  for (const slot of [-1, 24, 0.5, '0', null, undefined, 1]) assert.equal(garden.removePlant(slot), false);
  for (const parcelId of [-1, 1, 2, '0', null]) assert.equal(garden.removePlant(0, parcelId), false);
  assert.equal(garden.stone, 9);
  assert.deepEqual(garden.plants, [{ type: 'flower', slot: 0, seed: 1 }]);
});

test('removing plants updates expansion requirements and keeps parcels independent', () => {
  const saved = storage(JSON.stringify(eligibleSave({ stone: 900 })));
  const garden = createResources(saved);
  assert.equal(garden.canExpand(), true);
  assert.equal(garden.removePlant(0), true);
  assert.equal(garden.canExpand(), false);
  garden.plant('bush', 0, 99);
  assert.equal(garden.expand(hexDirections[0]), true);
  garden.plant('mushroom', 0, 12, 1);
  assert.equal(garden.removePlant(0, 1), true);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcel(1).plants, []);
  assert.equal(restored.plants.length, 17);
  assert.equal(restored.plants.find((plant) => plant.slot === 0).type, 'bush');
});

test('all 24 places can be planted exactly once', () => {
  const garden = createResources(storage('{"stone":100}'));
  plantingSlots.forEach((_, index) => assert.equal(garden.plant('bush', index, index), true));
  assert.equal(garden.plants.length, 24);
  assert.equal(garden.stone, 28);
  assert.equal(garden.plant('flower', 0, 42), false);
});

test('tree seed, position and growth start survive reload; planted trees cannot be removed or replaced', () => {
  const saved = storage('{"stone":5}');
  const garden = createResources(saved);
  garden.plant('flower', 0, 12);
  const tree = { x: 0.1, z: -0.2, seed: 123456, startedAt: Date.now() - 13000 };
  assert.equal(garden.setTree(tree), true);
  const restored = createResources(saved);
  assert.deepEqual(restored.tree, tree);
  assert.equal(restored.setTree(null), false);
  assert.equal(restored.setTree({ ...tree, seed: 987 }), false);
  const unchanged = createResources(saved);
  assert.deepEqual(unchanged.tree, tree);
  assert.equal(unchanged.stone, 4);
  assert.equal(unchanged.plants.length, 1);
});

test('invalid saved entries are ignored and unavailable storage is supported', () => {
  const garden = createResources(storage(JSON.stringify({ stone: 2, plants: [null, { type: 'flower', slot: 0, seed: 1 }, { type: 'bush', slot: 0, seed: 2 }, { type: 'flower', slot: 24, seed: 3 }], tree: { seed: 1, x: 9, z: 0, startedAt: 1 } })));
  assert.equal(garden.plants.length, 1);
  assert.equal(garden.tree, null);
  for (const value of ['invalid', 'null', '{"stone":-1}']) assert.equal(createResources(storage(value)).stone, 0);
  const temporary = createResources(undefined);
  temporary.mineStone();
  assert.equal(temporary.plant('flower', 0, 5), true);
  assert.equal(temporary.plants.length, 1);
});

test('stone is capped at 10,000, including old saves; spending frees capacity', () => {
  assert.equal(stoneLimit, 10000);
  const saved = storage('{"stone":9999}');
  const garden = createResources(saved);
  assert.equal(garden.mineStone(), 10000);
  assert.equal(garden.mineStone(), 10000);
  assert.equal(createResources(saved).stone, 10000);
  assert.equal(garden.plant('bush', 0, 1), true);
  assert.equal(garden.stone, 9997);
  assert.equal(garden.mineStone(), 9998);
  assert.equal(createResources(storage('{"stone":20000}')).stone, 10000);
});

function eligibleSave(overrides = {}) {
  const plants = ['bush', 'bush', 'bush', ...Array(6).fill('mushroom'), ...Array(8).fill('flower')]
    .map((type, slot) => ({ type, slot, seed: slot + 10 }));
  return { stone: expansionCost, plants, tree: { x: 0, z: 0, seed: 42, startedAt: 1000 }, ...overrides };
}

test('new game clears all progress persistently without changing the saved language', () => {
  const values = new Map([
    ['seed-garden-resources', JSON.stringify(eligibleSave({ stone: 900 }))],
    ['seed-garden-language', 'uk'],
  ]);
  const saved = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const garden = createResources(saved);
  assert.equal(garden.expand(hexDirections[2]), true);
  assert.equal(garden.plant('flower', 0, 12, 1), true);
  assert.equal(garden.setTree({ x: 0, z: 0, seed: 123, startedAt: Date.now() }, 1), true);
  garden.newGame();
  for (const state of [garden, createResources(saved)]) {
    assert.equal(state.stone, 0);
    assert.deepEqual(state.plants, []);
    assert.equal(state.tree, null);
    assert.equal(state.parcels.length, 1);
    assert.equal(state.setTree({ x: 0, z: 0, seed: 42, startedAt: Date.now() }), true);
  }
  assert.equal(values.get('seed-garden-language'), 'uk');
});

test('expansion requires all five conditions simultaneously, including mature tree', () => {
  const now = 1000 + growthDuration;
  assert.equal(createResources(storage(JSON.stringify(eligibleSave()))).canExpand(now), true);
  assert.equal(expansionCost, 150);
  for (const overrides of [{ stone: expansionCost - 1 }, { tree: null }, { tree: { x: 0, z: 0, seed: 42, startedAt: 1001 } },
    ...['bush', 'mushroom', 'flower'].map((type) => ({ plants: eligibleSave().plants.filter((plant, index, all) => index !== all.findIndex((entry) => entry.type === type)) }))]) {
    const garden = createResources(storage(JSON.stringify(eligibleSave(overrides))));
    assert.equal(garden.canExpand(now), false);
    assert.equal(garden.expand(hexDirections[0], now), false);
    assert.equal(garden.parcels.length, 1);
  }
});

test('each of six directions unlocks one persistent plot and spends exactly 150 stone', () => {
  hexDirections.forEach((position) => {
    const original = eligibleSave({ stone: expansionCost + 150 });
    const saved = storage(JSON.stringify(original));
    const garden = createResources(saved);
    assert.equal(garden.expand(position, 1000 + growthDuration), true);
    assert.equal(garden.stone, 150);
    assert.deepEqual(garden.plants, original.plants);
    assert.deepEqual(garden.tree, original.tree);
    assert.deepEqual(garden.parcel(1), { ...position, plants: [], tree: null, biome: 'meadow' });
    const restored = createResources(saved);
    assert.deepEqual(restored.parcel(1), garden.parcel(1));
    assert.equal(restored.canExpand(), false);
    assert.equal(restored.expand(restored.expansionTargets()[0]), false);
    assert.equal(restored.stone, 150);
  });
});

test('invalid, occupied and disconnected positions never spend stone or unlock a plot', () => {
  const garden = createResources(storage(JSON.stringify(eligibleSave())));
  for (const position of [-1, 6, 0.5, '0', null, undefined, {}, { q: 0, r: 0 }, { q: 4, r: 0 }, { q: 1.5, r: 0 }, { q: '1', r: 0 }]) assert.equal(garden.expand(position), false);
  assert.equal(garden.stone, expansionCost);
  assert.equal(garden.parcels.length, 1);
});

test('second plot has independent slots, persistent conifer biome and tree growth', () => {
  const saved = storage(JSON.stringify(eligibleSave({ stone: 900 })));
  const garden = createResources(saved);
  assert.equal(garden.plant('flower', 0, 12, 1), false);
  assert.equal(garden.setTree(eligibleSave().tree, 1), false);
  garden.expand(hexDirections[2]);
  assert.equal(garden.plant('flower', 0, 12, 1), true);
  assert.equal(garden.parcel(0).plants[0].type, 'bush');
  assert.equal(garden.parcel(1).plants[0].type, 'flower');
  const pine = { x: 0.2, z: 0.1, seed: 123, startedAt: Date.now() };
  assert.equal(garden.setTree(pine, 1), true);
  assert.equal(garden.parcel(1).biome, 'conifer');
  const restored = createResources(saved);
  assert.deepEqual(restored.parcel(1).tree, pine);
  assert.equal(restored.parcel(1).plants.length, 1);
  assert.equal(restored.setTree(null, 1), false);
  assert.equal(restored.setTree({ ...pine, seed: 987 }, 1), false);
  assert.deepEqual(createResources(saved).parcel(1).tree, pine);
  assert.equal(restored.parcel(1).biome, 'conifer');
  assert.equal(restored.parcel(1).plants.length, 1);
  assert.deepEqual(restored.tree, eligibleSave().tree);
  const copy = restored.parcels;
  copy[1].plants[0].seed = 99;
  copy[0].tree.seed = 99;
  assert.equal(restored.parcel(1).plants[0].seed, 12);
  assert.equal(restored.tree.seed, 42);
});

test('a new plot must meet its own requirements before expanding again', () => {
  const garden = createResources(storage(JSON.stringify(eligibleSave({ stone: 1000 }))));
  garden.expand(hexDirections[0]);
  assert.equal(garden.stone, 1000 - expansionCost);
  assert.equal(garden.canExpand(), false);
  assert.equal(garden.expansionProgress().parcelId, 1);
  assert.equal(garden.expand(garden.expansionTargets()[0]), false);
  assert.equal(garden.stone, 1000 - expansionCost);
});

test('legacy two-plot saves migrate in every direction with seeds, growth and biome intact', () => {
  hexDirections.forEach((position, direction) => {
    const first = eligibleSave();
    const second = { direction, plants: [{ type: 'flower', slot: 0, seed: 99 }],
      tree: { x: 0.1, z: -0.1, seed: 123, startedAt: 1500 }, biome: 'conifer' };
    const saved = storage(JSON.stringify({ ...first, second }));
    const garden = createResources(saved);
    assert.equal(garden.parcels.length, 2);
    assert.deepEqual(garden.parcel(1), { ...position, plants: second.plants, tree: second.tree, biome: 'conifer' });
    assert.deepEqual(garden.tree, first.tree);
    assert.deepEqual(garden.plants, first.plants);
    garden.mineStone();
    assert.deepEqual(createResources(saved).parcels, garden.parcels);
    assert.equal(JSON.parse(saved.getItem()).version, 2);
    assert.equal(Object.hasOwn(JSON.parse(saved.getItem()), 'second'), false);
  });
});

test('frontier positions are unique, unoccupied, adjacent, and have matching world coordinates', () => {
  const garden = createResources(storage(JSON.stringify(eligibleSave({ stone: 1000 }))));
  assert.deepEqual(garden.expansionTargets(), hexDirections);
  garden.expand(hexDirections[0]);
  const frontier = garden.expansionTargets();
  assert.equal(frontier.length, 8);
  assert.equal(new Set(frontier.map(hexKey)).size, frontier.length);
  for (const target of frontier) {
    assert.ok(!garden.parcels.some((parcel) => hexKey(parcel) === hexKey(target)));
    const adjacent = garden.parcels.filter((parcel) => hexDirections.some((delta) => parcel.q + delta.q === target.q && parcel.r + delta.r === target.r));
    assert.ok(adjacent.length > 0);
    for (const parcel of adjacent) {
      const a = parcelPosition(target);
      const b = parcelPosition(parcel);
      assert.ok(Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - 2 * 2.67 * Math.cos(Math.PI / 6)) < 1e-10);
    }
  }
});

function completeParcel(garden, id) {
  assert.equal(garden.setTree({ x: 0, z: 0, seed: id + 42, startedAt: 1000 }, id), true);
  eligibleSave().plants.forEach((plant) => {
    assert.equal(garden.plant(plant.type, plant.slot, plant.seed, id), true);
  });
}

test('a garden reaches exactly 12 persistent independent plots with alternating trees', () => {
  assert.equal(parcelLimit, 12);
  const saved = storage('{"stone":10000}');
  let garden = createResources(saved);
  for (let id = 0; id < parcelLimit; id++) {
    completeParcel(garden, id);
    assert.equal(garden.parcel(id).biome, treeKind(id) === 'pine' ? 'conifer' : 'meadow');
    assert.equal(garden.expansionProgress().parcelId, id);
    if (id === parcelLimit - 1) break;
    assert.equal(garden.canExpand(1000 + growthDuration), true);
    const balance = garden.stone;
    const target = garden.expansionTargets().at(-1);
    assert.equal(garden.expand(target, 1000 + growthDuration), true);
    assert.equal(garden.stone, balance - expansionCost);
    const snapshot = garden.parcels;
    garden = createResources(saved);
    assert.deepEqual(garden.parcels, snapshot);
    assert.equal(garden.canExpand(), false);
  }
  assert.equal(garden.parcels.length, 12);
  assert.equal(new Set(garden.parcels.map(hexKey)).size, 12);
  assert.equal(garden.canExpand(), false);
  assert.deepEqual(garden.expansionTargets(), []);
  const balance = garden.stone;
  assert.equal(garden.expand({ q: 1, r: 0 }), false);
  assert.equal(garden.stone, balance);
  assert.equal(garden.removePlant(0, 7), true);
  const restored = createResources(saved);
  assert.equal(restored.parcel(7).plants.length, 16);
  assert.equal(restored.parcel(6).plants.length, 17);
  assert.equal(restored.parcel(8).plants.length, 17);
  assert.equal(restored.setTree(null, 11), false);
  restored.newGame();
  assert.equal(createResources(saved).parcels.length, 1);
});

test('new-format saves reject duplicates, disconnected and malformed positions and enforce the cap', () => {
  const parcel = { q: 0, r: 0, plants: [], tree: null, biome: 'meadow' };
  const saved = storage(JSON.stringify({ stone: 1000, parcels: [parcel, null, parcel,
    { ...parcel, q: 5 }, { ...parcel, q: '1' }, { ...parcel, q: 0.5 }, { ...parcel, q: 1 }] }));
  const garden = createResources(saved);
  assert.deepEqual(garden.parcels.map(({ q, r }) => ({ q, r })), [{ q: 0, r: 0 }, { q: 1, r: 0 }]);
  for (const id of [-1, 0.5, '0', null, 2, 12]) {
    assert.equal(garden.parcel(id), null);
    assert.equal(garden.plant('flower', 0, 1, id), false);
    assert.equal(garden.removePlant(0, id), false);
    assert.equal(garden.setTree(eligibleSave().tree, id), false);
  }
  assert.equal(garden.stone, 1000);
  const oversized = createResources(storage(JSON.stringify({ parcels: Array.from({ length: 20 }, (_, q) => ({ ...parcel, q })) })));
  assert.equal(oversized.parcels.length, 12);
  assert.equal(oversized.canExpand(), false);
});
