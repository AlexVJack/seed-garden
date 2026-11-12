import test from 'node:test';
import assert from 'node:assert/strict';
import { createResources, stoneLimit } from '../resources.js';
import { plantingSlots } from '../garden-layout.js';

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

test('all 24 places can be planted exactly once', () => {
  const garden = createResources(storage('{"stone":100}'));
  plantingSlots.forEach((_, index) => assert.equal(garden.plant('bush', index, index), true));
  assert.equal(garden.plants.length, 24);
  assert.equal(garden.stone, 28);
  assert.equal(garden.plant('flower', 0, 42), false);
});

test('tree seed, position and growth start survive reload; reset preserves plants and stone', () => {
  const saved = storage('{"stone":5}');
  const garden = createResources(saved);
  garden.plant('flower', 0, 12);
  const tree = { x: 0.1, z: -0.2, seed: 123456, startedAt: Date.now() - 13000 };
  assert.equal(garden.setTree(tree), true);
  const restored = createResources(saved);
  assert.deepEqual(restored.tree, tree);
  restored.setTree(null);
  const reset = createResources(saved);
  assert.equal(reset.tree, null);
  assert.equal(reset.stone, 4);
  assert.equal(reset.plants.length, 1);
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
