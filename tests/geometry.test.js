import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { E, fresh, give, put, slotsOf } from './helpers.js';
import { chooseAction, chooseMulligan } from '../js/ai.js';

const json = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));

const layouts = [
  {
    zoneCols: [2, 2, 2],
    count: 12,
    zones: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
    slots: [
      [0, 0, 0, 0, [1, 2]],
      [1, 0, 0, 1, [0, 3]],
      [2, 0, 1, 0, [0, 3]],
      [3, 0, 1, 1, [1, 2]],
      [4, 1, 0, 0, [5, 6]],
      [5, 1, 0, 1, [4, 7]],
      [6, 1, 1, 0, [4, 7]],
      [7, 1, 1, 1, [5, 6]],
      [8, 2, 0, 0, [9, 10]],
      [9, 2, 0, 1, [8, 11]],
      [10, 2, 1, 0, [8, 11]],
      [11, 2, 1, 1, [9, 10]]
    ],
    freiFromZona1: [4, 5, 6, 7],
    freiFromCentral: [0, 1, 2, 3, 8, 9, 10, 11]
  },
  {
    zoneCols: [2, 1, 2],
    count: 10,
    zones: [[0, 1, 2, 3], [4, 5], [6, 7, 8, 9]],
    slots: [
      [0, 0, 0, 0, [1, 2]],
      [1, 0, 0, 1, [0, 3]],
      [2, 0, 1, 0, [0, 3]],
      [3, 0, 1, 1, [1, 2]],
      [4, 1, 0, 0, [5]],
      [5, 1, 1, 0, [4]],
      [6, 2, 0, 0, [7, 8]],
      [7, 2, 0, 1, [6, 9]],
      [8, 2, 1, 0, [6, 9]],
      [9, 2, 1, 1, [7, 8]]
    ],
    freiFromZona1: [4, 5],
    freiFromCentral: [0, 1, 2, 3, 6, 7, 8, 9]
  }
];

function withCols(zoneCols, check) {
  const copy = structuredClone(json);
  copy.RULES.zoneCols = zoneCols;
  E.loadCards(copy);
  try {
    check();
  } finally {
    E.loadCards(json);
  }
}

const ascending = list => [...list].sort((a, b) => a - b);
const freiMoves = (s, slot) => E.activeOptions(s, 0, slot).map(o => o.at.slot);

test('cards.json declares three zones of 2 columns and the central one as the wild zone', () => {
  assert.deepEqual(json.RULES.zoneCols, [2, 2, 2]);
  assert.equal(json.RULES.wildZone, 1);
  assert.equal(E.wildZone(), 1);
  assert.equal(E.ZONE_NAMES[E.wildZone()], 'Zona Central');
});

test('loadCards rebuilds the exported ZONES array in place', () => {
  const zones = E.ZONES;
  withCols([2, 1, 2], () => {
    assert.equal(E.ZONES, zones);
    assert.deepEqual(zones, [[0, 1, 2, 3], [4, 5], [6, 7, 8, 9]]);
  });
  assert.deepEqual(zones, [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]);
});

for (const g of layouts) {
  const name = `zoneCols ${g.zoneCols.join(' ')}`;

  test(`${name}: the zones are consecutive blocks with ${g.count} spaces per player`, () => withCols(g.zoneCols, () => {
    assert.deepEqual(E.ZONES, g.zones);
    assert.equal(E.slotCount(), g.count);
  }));

  for (const [slot, zone, row, col, near] of g.slots) {
    test(`${name}: space ${slot} is zone ${zone}, row ${row}, column ${col}, next to ${near.join(' and ')}`, () => withCols(g.zoneCols, () => {
      assert.deepEqual([E.zoneOf(slot), E.rowOf(slot), E.colOf(slot)], [zone, row, col]);
      assert.deepEqual(ascending(E.neighbors(slot)), near);
    }));
  }

  test(`${name}: a new game has one empty space per slot and a base unit can enter any of them`, () => withCols(g.zoneCols, () => {
    const s = fresh();
    assert.deepEqual(s.board.map(side => side.length), [g.count, g.count]);
    assert.ok(s.board.flat().every(c => c === null));
    assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'acolito'))), g.zones.flat());
  }));

  test(`${name}: spells and actives reach every space`, () => withCols(g.zoneCols, () => {
    const s = fresh();
    for (const [slot] of g.slots) {
      put(s, 0, slot, 'sta_santo');
      put(s, 1, slot, 'acolito');
    }
    assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'exposicao_jo'))), g.zones.flat());
    assert.deepEqual(ascending(E.legalActions(s).filter(a => a.type === 'active').map(a => a.slot)), g.zones.flat());
  }));

  test(`${name}: card adjacency is orthogonal inside the zone, never diagonal, never across zones`, () => withCols(g.zoneCols, () => {
    for (const [slot, , , , near] of g.slots) {
      for (const [other] of g.slots) {
        if (other === slot) continue;
        const s = fresh();
        put(s, 0, slot, 'seminarista');
        put(s, 0, other, 'capela');
        assert.equal(E.feOf(s, 0, slot), near.includes(other) ? 3 : 2, `Seminarista em ${slot}, Capela em ${other}`);
      }
    }
  }));

  test(`${name}: the Frei reaches every free space of the neighbouring zones`, () => withCols(g.zoneCols, () => {
    const lateral = fresh();
    put(lateral, 0, 3, 'frei');
    assert.deepEqual(freiMoves(lateral, 3), g.freiFromZona1);
    const central = fresh();
    put(central, 0, 4, 'frei');
    assert.deepEqual(freiMoves(central, 4), g.freiFromCentral);
  }));

  test(`${name}: a full AI against AI match ends with a winner and never leaves the board`, () => withCols(g.zoneCols, () => {
    const s = E.newGame({ decks: ['aq', 'jo'], seed: 7 });
    E.mulligan(s, 0, chooseMulligan(s, 0));
    E.mulligan(s, 1, chooseMulligan(s, 1));
    let steps = 0;
    while (s.phase === 'main' && steps++ < 5000) E.act(s, chooseAction(s));
    assert.equal(s.phase, 'over');
    assert.deepEqual(s.board.map(side => side.length), [g.count, g.count]);
  }));
}
