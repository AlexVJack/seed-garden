import test from 'node:test';
import assert from 'node:assert/strict';
import { createResources, stoneLimit } from '../resources.js';
import { plantingSlots, growthDuration, expansionCost, hexDirections, parcelLimit, parcelPosition, hexKey, treeKind, canPlantTree, treeBiomes, terrainSeed, moveTargets, connectedHexKeys } from '../garden-layout.js';
import { quarryLayout, quarryRadius } from '../terrain-layout.js';
import { gardenerCost, gardenerRoute, createGatheringCycle } from '../gardener-logic.js';
import { minerCost, minerPosition, createMiningCycle } from '../miner-logic.js';

function storage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
}

test('fruit defaults to zero in old saves and rejects invalid balances', () => {
  for (const fruit of [undefined, null, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) {
    const garden = createResources(storage(JSON.stringify({ stone: 12, fruit })));
    assert.equal(garden.fruit, 0);
    assert.equal(garden.stone, 12);
  }
  assert.equal(createResources(undefined).fruit, 0);
});

test('gardener costs 100 stone, can only be hired once, persists and resets', () => {
  assert.equal(gardenerCost, 100);
  const poor = createResources(storage('{"stone":99}'));
  assert.equal(poor.buyGardener(), false);
  assert.equal(poor.stone, 99);
  const saved = storage('{"stone":150}');
  const garden = createResources(saved);
  assert.equal(garden.hasGardener(), false);
  assert.equal(garden.buyGardener(), true);
  assert.equal(garden.stone, 50);
  assert.equal(garden.buyGardener(), false);
  const restored = createResources(saved);
  assert.equal(restored.hasGardener(), true);
  assert.equal(restored.stone, 50);
  restored.newGame();
  assert.equal(createResources(saved).hasGardener(), false);
});

test('fruit collection requires a purchased gardener and a mature tree', () => {
  const garden = createResources(storage('{"stone":100}'));
  assert.equal(garden.collectFruit(), false);
  garden.buyGardener();
  assert.equal(garden.collectFruit(), false);
  garden.setTree({ x: 0, z: 0, seed: 42, startedAt: Date.now() });
  assert.equal(garden.collectFruit(), false);
  const saved = storage(JSON.stringify({ stone: 0, gardener: true, tree: { x: 0, z: 0, seed: 42, startedAt: Date.now() - growthDuration } }));
  const mature = createResources(saved);
  assert.equal(mature.collectFruit(), true);
  assert.equal(mature.fruit, 1);
  assert.equal(createResources(saved).fruit, 1);
  assert.equal(mature.stone, 0);
});

function gardenerSave(count = 3, extra = {}) {
  return {
    version: 3, stone: 1000, fruit: 7,
    parcels: Array.from({ length: count }, (_, q) => ({
      q, r: 0, plants: [],
      tree: { x: 0, z: 0, seed: q + 1, startedAt: Date.now() - growthDuration - 1000 },
      treeType: q === 0 ? 'apple' : 'pine', biome: q === 0 ? 'meadow' : 'conifer',
    })),
    ...extra,
  };
}

test('miner costs exactly 100 fruit, not stone, with one per chosen plot', () => {
  assert.equal(minerCost, 100);
  const poor = createResources(storage(JSON.stringify(gardenerSave(3, { stone: 10000, fruit: 99 }))));
  assert.equal(poor.buyMiner(2), false);
  assert.equal(poor.fruit, 99);
  assert.equal(poor.stone, 10000);
  const saved = storage(JSON.stringify(gardenerSave(3, { stone: 0, fruit: 200 })));
  const garden = createResources(saved);
  assert.equal(garden.buyMiner(2), true);
  assert.equal(garden.hasMiner(0), false);
  assert.equal(garden.hasMiner(2), true);
  assert.equal(garden.fruit, 100);
  assert.equal(garden.stone, 0);
  assert.equal(garden.buyMiner(2), false);
  assert.equal(garden.fruit, 100);
  assert.equal(garden.buyMiner(1), true);
  const restored = createResources(saved);
  assert.equal(restored.fruit, 0);
  assert.equal(restored.hasMiner(1), true);
  assert.equal(restored.hasMiner(2), true);
});

test('miners need no tree, coexist with gardeners, and add to the same capped stone balance', () => {
  const state = gardenerSave(3, { stone: 100, fruit: 200 });
  state.parcels[1].tree = null;
  const saved = storage(JSON.stringify(state));
  const garden = createResources(saved);
  assert.equal(garden.buyGardener(1), true);
  assert.equal(garden.buyMiner(1), true);
  assert.equal(garden.collectFruit(1), false);
  assert.equal(garden.collectStone(1), true);
  assert.equal(garden.stone, 1);
  assert.equal(garden.fruit, 100);
  assert.equal(garden.collectStone(0), false);
  garden.buyMiner(2);
  garden.collectStone(2);
  assert.equal(garden.stone, 2);
  const restored = createResources(saved);
  assert.equal(restored.stone, 2);
  assert.equal(restored.hasGardener(1), true);
  assert.equal(restored.hasMiner(1), true);
  assert.equal(restored.hasMiner(2), true);
  const cappedSave = storage('{"stone":9999,"fruit":100}');
  const capped = createResources(cappedSave);
  capped.buyMiner();
  assert.equal(capped.collectStone(), true);
  const snapshot = cappedSave.getItem();
  assert.equal(capped.collectStone(), false);
  assert.equal(capped.stone, stoneLimit);
  assert.equal(cappedSave.getItem(), snapshot);
  capped.plant('flower', 0, 1);
  assert.equal(capped.collectStone(), true);
  assert.equal(capped.stone, stoneLimit);
});

test('miner transfers are free, persistent and independent of gardeners', () => {
  const saved = storage(JSON.stringify(gardenerSave(3, { fruit: 100 })));
  const garden = createResources(saved);
  garden.buyGardener(0);
  garden.buyGardener(2);
  garden.buyMiner(0);
  const before = garden.parcels.map(({ miner, ...parcel }) => parcel);
  const stone = garden.stone;
  const fruit = garden.fruit;
  assert.equal(garden.transferMiner(0, 2), true);
  assert.equal(garden.hasMiner(0), false);
  assert.equal(garden.hasMiner(2), true);
  assert.equal(garden.stone, stone);
  assert.equal(garden.fruit, fruit);
  assert.deepEqual(garden.parcels.map(({ miner, ...parcel }) => parcel), before);
  const restored = createResources(saved);
  assert.equal(restored.hasMiner(0), false);
  assert.equal(restored.hasMiner(2), true);
  assert.equal(restored.hasGardener(0), true);
  assert.equal(restored.hasGardener(2), true);
});

test('invalid miner actions never spend fruit, duplicate workers or alter snapshots', () => {
  const saved = storage(JSON.stringify(gardenerSave(3, { fruit: 300 })));
  const garden = createResources(saved);
  garden.buyMiner(0);
  garden.buyMiner(1);
  const snapshot = saved.getItem();
  for (const id of [-1, 3, 0.5, NaN, '1', null]) {
    assert.equal(garden.hasMiner(id), false);
    assert.equal(garden.buyMiner(id), false);
    assert.equal(garden.collectStone(id), false);
    assert.equal(garden.transferMiner(id, 2), false);
    assert.equal(garden.transferMiner(0, id), false);
  }
  for (const [from, to] of [[0, 0], [0, 1], [2, 0], [2, 2]]) assert.equal(garden.transferMiner(from, to), false);
  assert.equal(saved.getItem(), snapshot);
});

test('miners stay with shovel-moved plots; new game removes both worker roles', () => {
  const saved = storage(JSON.stringify(gardenerSave(3, { fruit: 100 })));
  const garden = createResources(saved);
  garden.buyGardener(2);
  garden.buyMiner(2);
  const before = garden.parcel(2);
  assert.equal(garden.moveParcel(2, garden.moveTargets(2)[0]), true);
  assert.equal(garden.hasMiner(2), true);
  assert.equal(garden.hasGardener(2), true);
  assert.deepEqual(garden.parcel(2).tree, before.tree);
  const restored = createResources(saved);
  assert.equal(restored.hasMiner(2), true);
  assert.equal(restored.collectStone(2), true);
  restored.newGame();
  assert.equal(restored.parcels.some(parcel => parcel.miner || parcel.gardener), false);
  assert.equal(createResources(saved).hasMiner(), false);
});

test('old saves have no miner, malformed flags are ignored, storage failures are tolerated', () => {
  for (const value of [undefined, 1, 'true', {}, null, false]) {
    const state = gardenerSave(1);
    state.parcels[0].miner = value;
    assert.equal(createResources(storage(JSON.stringify(state))).hasMiner(), false);
  }
  const temporary = createResources({
    getItem: () => '{"fruit":100}',
    setItem: () => { throw new Error('Storage unavailable'); },
  });
  assert.equal(temporary.buyMiner(), true);
  assert.equal(temporary.collectStone(), true);
  assert.equal(temporary.stone, 1);
});

test('all 36 miners persist without granting offline stone', () => {
  const saved = storage(JSON.stringify(gardenerSave(parcelLimit, { stone: 0, fruit: 3600 })));
  const garden = createResources(saved);
  for (let id = 0; id < parcelLimit; id++) {
    assert.equal(garden.buyMiner(id), true);
    assert.equal(garden.collectStone(id), true);
  }
  const restored = createResources(saved);
  assert.equal(restored.parcels.filter(parcel => parcel.miner).length, parcelLimit);
  assert.equal(restored.fruit, 0);
  assert.equal(restored.stone, parcelLimit);
});

test('mining strikes exactly once every three visible seconds, pauses and never catches up', () => {
  let strikes = 0;
  const cycle = createMiningCycle(() => strikes++);
  for (let i = 0; i < 29; i++) cycle.advance(100, true);
  assert.equal(strikes, 0);
  assert.equal(cycle.advance(100, true), true);
  assert.equal(strikes, 1);
  for (let i = 0; i < 30; i++) cycle.advance(100, true);
  assert.equal(strikes, 2);
  assert.equal(cycle.elapsed, 0);
  cycle.advance(600000, false);
  assert.equal(cycle.elapsed, 0);
  cycle.advance(600000, true);
  assert.equal(cycle.elapsed, 100);
  assert.equal(strikes, 2);
  for (const value of [NaN, Infinity, -1, 0]) cycle.advance(value, true);
  assert.equal(cycle.elapsed, 100);
});

test('miner positions stay on their plot, near the quarry, off planting places and gardener corridor', () => {
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      const quarry = quarryLayout({ q, r });
      const position = minerPosition(quarry);
      assert.deepEqual(position, minerPosition(quarry));
      assert.ok(Math.hypot(position.x - quarry.x, position.z - quarry.z) >= 0.47);
      assert.ok(Math.hypot(position.x - quarry.x, position.z - quarry.z) <= 0.63);
      assert.ok(Math.hypot(position.x, position.z) > 1.79);
      for (const slot of plantingSlots) assert.ok(Math.hypot(position.x - slot.x, position.z - slot.z) > 0.40);
      for (let side = 0; side < 6; side++) {
        const angle = side * Math.PI / 3;
        assert.ok(position.x * Math.cos(angle) + position.z * Math.sin(angle) < 2.67 * Math.cos(Math.PI / 6) - 0.14);
      }
    }
  }
});

test('gardeners can be hired on any plot first, with one per plot and a shared fruit balance', () => {
  const saved = storage(JSON.stringify(gardenerSave()));
  const garden = createResources(saved);
  assert.equal(garden.buyGardener(2), true);
  assert.equal(garden.hasGardener(0), false);
  assert.equal(garden.hasGardener(2), true);
  assert.equal(garden.collectFruit(0), false);
  assert.equal(garden.collectFruit(2), true);
  assert.equal(garden.buyGardener(1), true);
  assert.equal(garden.buyGardener(1), false);
  assert.equal(garden.collectFruit(1), true);
  assert.equal(garden.fruit, 9);
  assert.equal(garden.stone, 800);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, garden.parcels);
  assert.equal(restored.fruit, 9);
});

test('free transfer moves exactly one gardener, persists and does not duplicate a migrated gardener', () => {
  const saved = storage(JSON.stringify(gardenerSave(3, { gardener: true })));
  const garden = createResources(saved);
  assert.equal(garden.hasGardener(0), true);
  const before = garden.parcels;
  assert.equal(garden.transferGardener(0, 2), true);
  assert.equal(garden.hasGardener(0), false);
  assert.equal(garden.hasGardener(2), true);
  assert.equal(garden.stone, 1000);
  assert.equal(garden.fruit, 7);
  assert.deepEqual(garden.parcels.map(({ gardener, ...plot }) => plot), before.map(({ gardener, ...plot }) => plot));
  const restored = createResources(saved);
  assert.equal(restored.hasGardener(0), false);
  assert.equal(restored.hasGardener(2), true);
  assert.equal(JSON.parse(saved.getItem()).gardener, undefined);
  assert.equal(restored.collectFruit(0), false);
  assert.equal(restored.collectFruit(2), true);
});

test('invalid hires and transfers do not change balances, plots or saved snapshot', () => {
  const saved = storage(JSON.stringify(gardenerSave()));
  const garden = createResources(saved);
  garden.buyGardener(0);
  garden.buyGardener(1);
  const snapshot = saved.getItem();
  for (const id of [-1, 3, 0.5, NaN, '1', null]) {
    assert.equal(garden.buyGardener(id), false);
    assert.equal(garden.hasGardener(id), false);
    assert.equal(garden.collectFruit(id), false);
    assert.equal(garden.transferGardener(id, 2), false);
    assert.equal(garden.transferGardener(0, id), false);
  }
  for (const [from, to] of [[0, 0], [0, 1], [2, 0], [2, 2]]) assert.equal(garden.transferGardener(from, to), false);
  assert.equal(saved.getItem(), snapshot);
});

test('gardeners wait for their own tree, remain with moved plots, and all reset on new game', () => {
  const state = gardenerSave();
  state.parcels[2].tree = null;
  const saved = storage(JSON.stringify(state));
  const garden = createResources(saved);
  garden.buyGardener(0);
  garden.buyGardener(2);
  assert.equal(garden.collectFruit(2), false);
  assert.equal(garden.collectFruit(0), true);
  const target = garden.moveTargets(2)[0];
  assert.equal(garden.moveParcel(2, target), true);
  assert.equal(garden.hasGardener(2), true);
  const restored = createResources(saved);
  assert.equal(restored.hasGardener(2), true);
  assert.equal(restored.parcel(2).tree, null);
  assert.equal(restored.transferGardener(0, 1), true);
  assert.equal(restored.collectFruit(1), true);
  restored.newGame();
  assert.equal(restored.parcels.some(plot => plot.gardener), false);
  assert.equal(createResources(saved).fruit, 0);
});

test('all 36 plots can hire independent gardeners and restore them without offline fruit', () => {
  const saved = storage(JSON.stringify(gardenerSave(parcelLimit, { stone: 10000 })));
  const garden = createResources(saved);
  for (let id = 0; id < parcelLimit; id++) {
    assert.equal(garden.buyGardener(id), true);
    assert.equal(garden.collectFruit(id), true);
  }
  const restored = createResources(saved);
  assert.equal(restored.parcels.filter(plot => plot.gardener).length, parcelLimit);
  assert.equal(restored.fruit, 7 + parcelLimit);
  assert.equal(restored.stone, 10000 - parcelLimit * gardenerCost);
});

test('malformed gardener flags are ignored and legacy single-plot ownership migrates', () => {
  for (const value of [1, 'true', {}, null, false]) {
    const state = gardenerSave(1, { gardener: value });
    state.parcels[0].gardener = value;
    assert.equal(createResources(storage(JSON.stringify(state))).hasGardener(0), false);
  }
  assert.equal(createResources(storage('{"gardener":true}')).hasGardener(0), true);
});

test('gathering picks once per three-second cycle, pauses and never catches up', () => {
  let fruit = 0;
  const cycle = createGatheringCycle(() => fruit++);
  for (let i = 0; i < 60; i++) cycle.advance(100, true);
  assert.equal(fruit, 2);
  assert.equal(cycle.elapsed, 0);
  cycle.advance(600000, false);
  assert.equal(cycle.elapsed, 0);
  assert.equal(fruit, 2);
  cycle.advance(600000, true);
  assert.equal(cycle.elapsed, 100);
  assert.equal(fruit, 2);
  for (const invalid of [NaN, Infinity, -1, 0]) cycle.advance(invalid, true);
  assert.equal(cycle.elapsed, 100);
});

test('gardener route segments avoid the quarry, tree center and planting places', () => {
  const quarry = quarryLayout({ q: 0, r: 0 });
  const route = gardenerRoute(quarry);
  for (let i = 1; i < route.length; i++) {
    for (let step = 0; step <= 20; step++) {
      const fraction = step / 20;
      const x = route[i - 1].x * (1 - fraction) + route[i].x * fraction;
      const z = route[i - 1].z * (1 - fraction) + route[i].z * fraction;
      assert.ok(Math.hypot(x, z) > 1.4);
      assert.ok(Math.hypot(x - quarry.x, z - quarry.z) > quarryRadius + 0.2);
      for (const slot of plantingSlots) assert.ok(Math.hypot(x - slot.x, z - slot.z) > 0.37);
    }
  }
});

test('fruit persists independently of stone and resets with a new game', () => {
  const saved = storage(JSON.stringify({ stone: 12, fruit: 27 }));
  const garden = createResources(saved);
  assert.equal(garden.fruit, 27);
  garden.mineStone();
  garden.plant('flower', 0, 42);
  const restored = createResources(saved);
  assert.equal(restored.fruit, 27);
  assert.equal(restored.stone, 12);
  assert.equal(restored.plants.length, 1);
  restored.newGame();
  assert.equal(restored.fruit, 0);
  assert.equal(createResources(saved).fruit, 0);
});

test('terrain seeds are stable unsigned integers and distinguish neighboring plots', () => {
  const positions = [{ q: 0, r: 0 }, ...hexDirections];
  const seeds = positions.map(terrainSeed);
  assert.equal(new Set(seeds).size, positions.length);
  const allSeeds = new Set();
  for (let q = -parcelLimit + 1; q < parcelLimit; q++) {
    for (let r = -parcelLimit + 1; r < parcelLimit; r++) allSeeds.add(terrainSeed({ q, r }));
  }
  assert.equal(allSeeds.size, (parcelLimit * 2 - 1) ** 2);
  for (const position of positions) {
    const seed = terrainSeed(position);
    assert.equal(seed, terrainSeed(JSON.parse(JSON.stringify(position))));
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  }
});

test('terrain seeds preserve the appearance of all previously available plots', () => {
  for (let q = -11; q <= 11; q++) {
    for (let r = -11; r <= 11; r++) {
      assert.equal(terrainSeed({ q, r }), (Math.imul(q + 12 + (r + 12) * 25, 0x9e3779b1) ^ 42) >>> 0);
    }
  }
});

test('every possible plot gets a stable quarry clear of planting slots, the tree and hexagon edges', () => {
  const positions = new Set();
  const shapes = new Set();
  const sectors = new Set();
  for (let q = -parcelLimit + 1; q < parcelLimit; q++) {
    for (let r = -parcelLimit + 1; r < parcelLimit; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) >= parcelLimit) continue;
      const layout = quarryLayout({ q, r });
      assert.deepEqual(layout, quarryLayout({ q, r }));
      assert.ok(Math.hypot(layout.x, layout.z) >= 1.65);
      for (const slot of plantingSlots) assert.ok(Math.hypot(layout.x - slot.x, layout.z - slot.z) >= quarryRadius + 0.26);
      for (let side = 0; side < 6; side++) {
        const angle = side * Math.PI / 3;
        assert.ok(layout.x * Math.cos(angle) + layout.z * Math.sin(angle) <= 2.67 * Math.cos(Math.PI / 6) - quarryRadius - 0.02);
      }
      assert.ok(layout.width <= quarryRadius && layout.depth <= quarryRadius);
      assert.ok(layout.height >= 0.4 && layout.height <= 0.55);
      positions.add(`${layout.x},${layout.z}`);
      shapes.add(layout.shapeSeed);
      sectors.add(Math.floor((Math.atan2(layout.z, layout.x) + Math.PI) / (Math.PI / 3)) % 6);
    }
  }
  assert.ok(positions.size > 30);
  assert.equal(sectors.size, 6);
  assert.ok(shapes.size > 350);
});

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
    assert.deepEqual(garden.parcel(1), { ...position, plants: second.plants, tree: second.tree, treeType: 'pine', biome: 'conifer' });
    assert.deepEqual(garden.tree, first.tree);
    assert.deepEqual(garden.plants, first.plants);
    garden.mineStone();
    assert.deepEqual(createResources(saved).parcels, garden.parcels);
    assert.equal(JSON.parse(saved.getItem()).version, 3);
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

test('a garden reaches exactly 36 persistent independent plots with alternating trees', () => {
  assert.equal(parcelLimit, 36);
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
  assert.equal(garden.parcels.length, 36);
  assert.equal(new Set(garden.parcels.map(hexKey)).size, 36);
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
  const oversized = createResources(storage(JSON.stringify({ parcels: Array.from({ length: 40 }, (_, q) => ({ ...parcel, q })) })));
  assert.equal(oversized.parcels.length, 36);
  assert.equal(oversized.canExpand(), false);
});

test('plots 2 through 36 accept either tree and preserve the chosen species and biome on reload', () => {
  for (let id = 1; id < parcelLimit; id++) {
    for (const type of ['apple', 'pine']) {
      const parcels = Array.from({ length: id + 1 }, (_, q) => ({ q, r: 0, plants: [], tree: null, biome: 'meadow' }));
      const saved = storage(JSON.stringify({ stone: 200, parcels }));
      const garden = createResources(saved);
      assert.equal(garden.setTree(eligibleSave().tree, id, type), true);
      const restored = createResources(saved);
      assert.equal(restored.parcel(id).treeType, type);
      assert.equal(restored.parcel(id).biome, type === 'pine' ? 'conifer' : 'meadow');
      assert.deepEqual(restored.parcel(id).tree, eligibleSave().tree);
      assert.equal(restored.setTree(eligibleSave().tree, id, type === 'pine' ? 'apple' : 'pine'), false);
    }
  }
});

test('the first plot requires an apple tree and invalid species cannot be planted', () => {
  const garden = createResources(storage(JSON.stringify({ parcels: [
    { q: 0, r: 0, plants: [], tree: null }, { q: 1, r: 0, plants: [], tree: null }, { q: 2, r: 0, plants: [], tree: null },
  ] })));
  assert.equal(garden.setTree(eligibleSave().tree, 0, 'pine'), false);
  for (const id of [0, 1, 2]) {
    for (const type of ['oak', '', null, 42]) assert.equal(garden.setTree(eligibleSave().tree, id, type), false);
  }
  assert.equal(garden.setTree(eligibleSave().tree, 0, 'apple'), true);
  assert.equal(garden.setTree(eligibleSave().tree, 1, 'pine'), true);
});

test('existing multi-plot saves without explicit species retain their original trees', () => {
  const parcels = Array.from({ length: 12 }, (_, q) => ({ q, r: 0, plants: [], tree: { ...eligibleSave().tree, seed: q + 42 },
    biome: treeKind(q) === 'pine' ? 'conifer' : 'meadow' }));
  const saved = storage(JSON.stringify({ version: 2, stone: 200, parcels }));
  const garden = createResources(saved);
  garden.parcels.forEach((parcel, id) => {
    assert.equal(parcel.treeType, treeKind(id));
    assert.equal(parcel.tree.seed, id + 42);
    assert.equal(parcel.biome, parcels[id].biome);
  });
  garden.mineStone();
  assert.deepEqual(createResources(saved).parcels, garden.parcels);
});

test('an existing full 12-plot garden can expand without losing progress', () => {
  const parcels = Array.from({ length: 12 }, (_, q) => ({ ...eligibleSave(), q, r: 0 }));
  const saved = storage(JSON.stringify({ version: 2, stone: 1000, parcels }));
  const garden = createResources(saved);
  const before = garden.parcels;
  assert.equal(garden.canExpand(), true);
  assert.equal(garden.expand({ q: 12, r: 0 }), true);
  const restored = createResources(saved);
  assert.equal(restored.parcels.length, 13);
  assert.deepEqual(restored.parcels.slice(0, 12), before);
  assert.equal(restored.stone, 1000 - expansionCost);
});

test('baobab unlocks at three plots and can then be planted on the empty second plot', () => {
  const tree = eligibleSave().tree;
  const twoPlots = [0, 1].map((q) => ({ q, r: 0, plants: [], tree: null }));
  const locked = createResources(storage(JSON.stringify({ parcels: twoPlots })));
  assert.equal(locked.setTree(tree, 1, 'baobab'), false);
  assert.equal(canPlantTree('baobab', 1, 2), false);
  assert.equal(canPlantTree('baobab', 1, 3), true);
  assert.equal(canPlantTree('baobab', 0, 3), false);
  const saved = storage(JSON.stringify({ parcels: [...twoPlots, { q: 2, r: 0, plants: [], tree: null }] }));
  const garden = createResources(saved);
  assert.equal(garden.setTree(tree, 0, 'baobab'), false);
  assert.equal(garden.setTree(tree, 1, 'baobab'), true);
  const restored = createResources(saved);
  assert.equal(restored.parcel(1).treeType, 'baobab');
  assert.equal(restored.parcel(1).biome, 'savanna');
  assert.deepEqual(restored.parcel(1).tree, tree);
});

test('all unlocked species persist on plots 3 through 36 with independent biome and plants', () => {
  for (let id = 2; id < parcelLimit; id++) {
    for (const type of Object.keys(treeBiomes)) {
      if (!canPlantTree(type, id, id + 1)) continue;
      const parcels = Array.from({ length: id + 1 }, (_, q) => ({ q, r: 0, plants: [], tree: null }));
      const saved = storage(JSON.stringify({ stone: 100, parcels }));
      const garden = createResources(saved);
      assert.equal(garden.plant('flower', 0, 99, id), true);
      assert.equal(garden.setTree(eligibleSave().tree, id, type), true);
      const restored = createResources(saved);
      assert.equal(restored.parcel(id).treeType, type);
      assert.equal(restored.parcel(id).biome, treeBiomes[type]);
      assert.deepEqual(restored.parcel(id).plants, [{ type: 'flower', slot: 0, seed: 99 }]);
      assert.equal(restored.parcel(id - 1).biome, 'meadow');
      assert.equal(restored.setTree(eligibleSave().tree, id, 'apple'), false);
    }
  }
});

test('palm unlocks at four plots, preserves desert plants and supports expansion and shears', () => {
  const parcels = Array.from({ length: 3 }, (_, q) => ({ q, r: 0, plants: [], tree: null }));
  const locked = createResources(storage(JSON.stringify({ parcels })));
  assert.equal(locked.setTree(eligibleSave().tree, 1, 'palm'), false);
  parcels.push({ q: 3, r: 0, plants: [], tree: null });
  const saved = storage(JSON.stringify({ stone: 1000, parcels }));
  const garden = createResources(saved);
  assert.equal(garden.setTree(eligibleSave().tree, 0, 'palm'), false);
  assert.equal(garden.setTree(eligibleSave().tree, 1, 'palm'), true);
  assert.equal(garden.setTree(eligibleSave().tree, 3, 'palm'), true);
  eligibleSave().plants.forEach(({ type, slot, seed }) => assert.equal(garden.plant(type, slot, seed, 3), true));
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, garden.parcels);
  assert.equal(restored.parcel(3).treeType, 'palm');
  assert.equal(restored.parcel(3).biome, 'desert');
  assert.equal(restored.canExpand(), true);
  assert.equal(restored.removePlant(0, 3), true);
  assert.equal(restored.canExpand(), false);
  assert.equal(restored.plant('bush', 0, 99, 3), true);
  assert.equal(restored.expand({ q: 4, r: 0 }), true);
  assert.equal(createResources(saved).parcel(3).biome, 'desert');
});

test('sakura unlocks at five plots and preserves blossom biome, growth, plants and expansion', () => {
  const parcels = Array.from({ length: 4 }, (_, q) => ({ q, r: 0, plants: [], tree: null }));
  const tree = eligibleSave().tree;
  const locked = createResources(storage(JSON.stringify({ parcels })));
  assert.equal(locked.setTree(tree, 1, 'sakura'), false);
  assert.equal(canPlantTree('sakura', 1, 4), false);
  assert.equal(canPlantTree('sakura', 1, 5), true);
  parcels.push({ q: 4, r: 0, plants: [], tree: null });
  const saved = storage(JSON.stringify({ stone: 1000, parcels }));
  const garden = createResources(saved);
  assert.equal(garden.setTree(tree, 0, 'sakura'), false);
  assert.equal(garden.setTree(tree, 1, 'sakura'), true);
  const growingTree = { ...tree, seed: 8742, startedAt: Date.now() };
  assert.equal(garden.setTree(growingTree, 4, 'sakura'), true);
  const before = garden.stone;
  eligibleSave().plants.forEach(({ type, slot, seed }) => assert.equal(garden.plant(type, slot, seed, 4), true));
  assert.equal(garden.stone, before - 29);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, garden.parcels);
  assert.deepEqual(restored.parcel(4).tree, growingTree);
  assert.equal(restored.parcel(4).treeType, 'sakura');
  assert.equal(restored.parcel(4).biome, 'blossom');
  assert.equal(restored.parcel(3).biome, 'meadow');
  assert.equal(restored.setTree(tree, 4, 'apple'), false);
  assert.equal(restored.canExpand(growingTree.startedAt + growthDuration - 1), false);
  assert.equal(restored.canExpand(growingTree.startedAt + growthDuration), true);
  assert.equal(restored.removePlant(0, 4), true);
  assert.equal(restored.canExpand(growingTree.startedAt + growthDuration), false);
  assert.equal(restored.plant('bush', 0, 99, 4), true);
  assert.equal(restored.expand({ q: 5, r: 0 }, growingTree.startedAt + growthDuration), true);
  assert.equal(createResources(saved).parcel(4).biome, 'blossom');
});

test('dark oak unlocks at six plots and preserves forest, growth, plants, shears and expansion', () => {
  const parcels = Array.from({ length: 5 }, (_, q) => ({ q, r: 0, plants: [], tree: null }));
  const tree = eligibleSave().tree;
  const locked = createResources(storage(JSON.stringify({ parcels })));
  assert.equal(locked.setTree(tree, 1, 'darkOak'), false);
  assert.equal(canPlantTree('darkOak', 1, 5), false);
  assert.equal(canPlantTree('darkOak', 1, 6), true);
  parcels.push({ q: 5, r: 0, plants: [], tree: null });
  const saved = storage(JSON.stringify({ stone: 1000, parcels }));
  const garden = createResources(saved);
  assert.equal(garden.setTree(tree, 0, 'darkOak'), false);
  assert.equal(garden.setTree(tree, 1, 'darkOak'), true);
  const growingTree = { ...tree, seed: 93421, startedAt: Date.now() };
  assert.equal(garden.setTree(growingTree, 5, 'darkOak'), true);
  const before = garden.stone;
  eligibleSave().plants.forEach(({ type, slot, seed }) => assert.equal(garden.plant(type, slot, seed, 5), true));
  assert.equal(garden.stone, before - 29);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, garden.parcels);
  assert.deepEqual(restored.parcel(5).tree, growingTree);
  assert.equal(restored.parcel(5).treeType, 'darkOak');
  assert.equal(restored.parcel(5).biome, 'darkForest');
  assert.equal(restored.parcel(4).biome, 'meadow');
  assert.equal(restored.setTree(tree, 5, 'apple'), false);
  const matureAt = growingTree.startedAt + growthDuration;
  assert.equal(restored.canExpand(matureAt - 1), false);
  assert.equal(restored.canExpand(matureAt), true);
  assert.equal(restored.removePlant(0, 5), true);
  assert.equal(restored.canExpand(matureAt), false);
  assert.equal(restored.plant('bush', 0, 99, 5), true);
  assert.equal(restored.expand({ q: 6, r: 0 }, matureAt), true);
  assert.equal(createResources(saved).parcel(5).biome, 'darkForest');
});

test('maple unlocks at seven plots and preserves autumn, growth, plants, shears and expansion', () => {
  const parcels = Array.from({ length: 6 }, (_, q) => ({ q, r: 0, plants: [], tree: null }));
  const tree = eligibleSave().tree;
  const locked = createResources(storage(JSON.stringify({ parcels })));
  assert.equal(locked.setTree(tree, 1, 'maple'), false);
  assert.equal(canPlantTree('maple', 1, 6), false);
  assert.equal(canPlantTree('maple', 1, 7), true);
  parcels.push({ q: 6, r: 0, plants: [], tree: null });
  const saved = storage(JSON.stringify({ stone: 1000, parcels }));
  const garden = createResources(saved);
  assert.equal(garden.setTree(tree, 0, 'maple'), false);
  assert.equal(garden.setTree(tree, 1, 'maple'), true);
  const growingTree = { ...tree, seed: 57814, startedAt: Date.now() };
  assert.equal(garden.setTree(growingTree, 6, 'maple'), true);
  const before = garden.stone;
  eligibleSave().plants.forEach(({ type, slot, seed }) => assert.equal(garden.plant(type, slot, seed, 6), true));
  assert.equal(garden.stone, before - 29);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, garden.parcels);
  assert.deepEqual(restored.parcel(6).tree, growingTree);
  assert.equal(restored.parcel(6).treeType, 'maple');
  assert.equal(restored.parcel(6).biome, 'autumn');
  assert.equal(restored.parcel(5).biome, 'meadow');
  assert.equal(restored.setTree(tree, 6, 'apple'), false);
  const matureAt = growingTree.startedAt + growthDuration;
  assert.equal(restored.canExpand(matureAt - 1), false);
  assert.equal(restored.canExpand(matureAt), true);
  assert.equal(restored.removePlant(0, 6), true);
  assert.equal(restored.canExpand(matureAt), false);
  assert.equal(restored.plant('bush', 0, 99, 6), true);
  assert.equal(restored.expand({ q: 7, r: 0 }, matureAt), true);
  assert.equal(createResources(saved).parcel(6).biome, 'autumn');
});

test('shovel fixes the first plot and prevents removing connecting plots', () => {
  const parcels = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
  assert.deepEqual(moveTargets(parcels, 0), []);
  assert.deepEqual(moveTargets(parcels, 1), []);
  assert.ok(moveTargets(parcels, 2).length > 0);
  for (const id of [-1, 3, 1.5, NaN, '1', null]) assert.deepEqual(moveTargets(parcels, id), []);
  assert.deepEqual(moveTargets([{ q: 0, r: 0 }], 0), []);
});

test('move targets are unique free neighbors, excluding the old position', () => {
  const parcels = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }];
  const targets = moveTargets(parcels, 1);
  const keys = targets.map(hexKey);
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(targets.length > 0);
  for (const target of targets) {
    assert.ok(!parcels.some((parcel) => hexKey(parcel) === hexKey(target)));
    const moved = parcels.map((parcel, id) => id === 1 ? target : parcel);
    assert.equal(connectedHexKeys(moved).size, moved.length);
  }
});

test('moving preserves plot identity, tree, growth, plants, biome and stone after reload', () => {
  const tree = { ...eligibleSave().tree, startedAt: Date.now() };
  const parcels = [
    { q: 0, r: 0, tree: null, plants: [] },
    { q: 1, r: 0, tree, treeType: 'pine', biome: 'conifer', plants: eligibleSave().plants },
    { q: 0, r: 1, tree: null, plants: [] },
  ];
  const saved = storage(JSON.stringify({ version: 2, stone: 712, parcels }));
  const garden = createResources(saved);
  const before = garden.parcels;
  // Plot 2 now depends on later-created plot 3 for its connection to the origin.
  assert.equal(garden.moveParcel(1, { q: 0, r: 2 }), true);
  const expected = before.map((parcel, id) => id === 1 ? { ...parcel, q: 0, r: 2 } : parcel);
  assert.deepEqual(garden.parcels, expected);
  assert.equal(garden.stone, 712);
  assert.equal(JSON.parse(saved.getItem()).version, 3);
  const restored = createResources(saved);
  assert.deepEqual(restored.parcels, expected);
  assert.equal(restored.stone, 712);
  assert.deepEqual(restored.parcel(1).tree, tree);
  assert.deepEqual(restored.moveTargets(2), []);
});

test('invalid moves leave the entire garden and stored snapshot unchanged', () => {
  const saved = storage(JSON.stringify({ stone: 987, parcels: [
    { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
  ] }));
  const garden = createResources(saved);
  const before = garden.parcels;
  const snapshot = saved.getItem();
  for (const [id, target] of [
    [0, { q: 0, r: 1 }], [1, { q: 0, r: 1 }], [2, { q: 2, r: 0 }],
    [2, { q: 0, r: 0 }], [2, { q: 12, r: 12 }], [2, null],
    [2, { q: 0.5, r: 0 }], [2, { q: '0', r: 1 }], [2, { q: NaN, r: 0 }],
    [-1, { q: 0, r: 1 }], [3, { q: 0, r: 1 }],
  ]) assert.equal(garden.moveParcel(id, target), false);
  assert.deepEqual(garden.parcels, before);
  assert.equal(garden.stone, 987);
  assert.equal(saved.getItem(), snapshot);
});

test('moving the latest plot does not change expansion requirements or source', () => {
  const saved = storage(JSON.stringify({ stone: 1000, parcels: [
    { q: 0, r: 0 }, { q: 1, r: 0, ...eligibleSave(), treeType: 'pine' },
  ] }));
  const garden = createResources(saved);
  const progress = garden.expansionProgress();
  assert.equal(garden.canExpand(), true);
  assert.equal(garden.moveParcel(1, { q: 0, r: -1 }), true);
  assert.deepEqual(garden.expansionProgress(), progress);
  assert.equal(garden.expand({ q: 0, r: -2 }), true);
  assert.equal(garden.stone, 850);
  assert.deepEqual(createResources(saved).parcels, garden.parcels);
});

test('shovel works at the plot cap and repeated moves preserve every numbered plot', () => {
  const parcels = Array.from({ length: parcelLimit }, (_, q) => ({ q, r: 0 }));
  const saved = storage(JSON.stringify({ parcels }));
  let garden = createResources(saved);
  assert.deepEqual(garden.expansionTargets(), []);
  for (let i = 0; i < 12; i++) {
    const target = garden.moveTargets(parcelLimit - 1)[i % garden.moveTargets(parcelLimit - 1).length];
    assert.ok(target);
    assert.equal(garden.moveParcel(parcelLimit - 1, target), true);
    const before = garden.parcels;
    garden = createResources(saved);
    assert.equal(garden.parcels.length, parcelLimit);
    assert.deepEqual(garden.parcels, before);
  }
});

test('version 3 restores only the connected origin component and rejects malformed and duplicate positions', () => {
  const saved = storage(JSON.stringify({ version: 3, stone: 42, parcels: [
    { q: 0, r: 0 }, { q: 0, r: 2 }, { q: 0, r: 1 },
    { q: 0, r: 1 }, { q: 10, r: 10 }, null, { q: 0.5, r: 0 },
  ] }));
  const garden = createResources(saved);
  assert.deepEqual(garden.parcels.map(({ q, r }) => ({ q, r })), [{ q: 0, r: 0 }, { q: 0, r: 2 }, { q: 0, r: 1 }]);
  assert.equal(garden.stone, 42);
});
