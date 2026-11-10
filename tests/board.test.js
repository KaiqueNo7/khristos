import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, endRound, slotsOf, ids } from './helpers.js';

test('a base unit can enter any free slot on its owner side', () => {
  const s = fresh();
  const uid = give(s, 0, 'acolito');
  const plays = E.legalPlays(s, 0, uid);
  assert.deepEqual(slotsOf(plays), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(plays.every(x => x.kind === 'play' && x.at.p === 0));
});

test('an evolution card cannot enter the board without its predecessor', () => {
  const s = fresh();
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'padre')), []);
});

test('an evolution is played on top of its predecessor, which stays underneath', () => {
  const s = fresh();
  put(s, 0, 2, 'acolito');
  const uid = give(s, 0, 'seminarista');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'evolve', at: { p: 0, slot: 2 } }]);
  const events = play(s, uid, { p: 0, slot: 2 });
  assert.equal(s.board[0][2].id, 'seminarista');
  assert.deepEqual(s.board[0][2].under, ['acolito']);
  assert.deepEqual(s.players[0].retiro, []);
  assert.ok(events.some(e => e.t === 'evolve' && e.slot === 2 && e.from === 'acolito' && e.id === 'seminarista'));
});

test('a card cannot evolve on the turn it entered, only from the next turn on', () => {
  const s = fresh();
  const base = give(s, 0, 'acolito');
  const evo = give(s, 0, 'seminarista');
  play(s, base, { p: 0, slot: 0 });
  assert.deepEqual(E.legalPlays(s, 0, evo), []);
  endRound(s);
  s.players[0].sab = 99;
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, evo)), [0]);
});

test('an evolution needs its minimum Fé in the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'seminarista');
  const uid = give(s, 0, 'diacono');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 3, 'capela');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
});

test('an evolution that requires domination is blocked while the opponent leads the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'padre');
  put(s, 0, 3, 'igreja');
  put(s, 1, 0, 'mosteiro_beneditino');
  put(s, 1, 1, 'capela');
  const uid = give(s, 0, 'bispo');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  s.board[1][1] = null;
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
});

test('evolving pays only the cost difference to the card underneath', () => {
  const s = fresh();
  put(s, 0, 0, 'padre');
  put(s, 0, 3, 'igreja');
  const uid = give(s, 0, 'bispo');
  s.players[0].sab = 1;
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  s.players[0].sab = 2;
  assert.equal(E.costOf(s, 0, 'bispo'), 2);
  play(s, uid, { p: 0, slot: 0 });
  assert.equal(s.players[0].sab, 0);
});

test('an evolved card keeps its relics and permanent modifiers', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { relics: [{ id: 'relicario' }], feMod: 2, fraqMod: -1 });
  play(s, give(s, 0, 'seminarista'), { p: 0, slot: 0 });
  const c = s.board[0][0];
  assert.deepEqual(c.relics.map(r => r.id), ['relicario']);
  assert.deepEqual([c.feMod, c.fraqMod], [2, -1]);
});

test('a base card can replace an own card only when the zone has no free slot', () => {
  const s = fresh();
  put(s, 0, 4, 'capela');
  const uid = give(s, 0, 'monge');
  assert.ok(!slotsOf(E.legalPlays(s, 0, uid)).includes(4));
  put(s, 0, 5, 'acolito');
  put(s, 0, 6, 'acolito');
  assert.ok(!slotsOf(E.legalPlays(s, 0, uid)).includes(4));
  put(s, 0, 7, 'acolito');
  const inCentral = E.legalPlays(s, 0, uid).filter(x => x.at.slot >= 4 && x.at.slot <= 7);
  assert.deepEqual(inCentral.map(x => x.kind), ['replace', 'replace', 'replace', 'replace']);
});

test('a replaced card goes to the Retiro with its stack and relics', () => {
  const s = fresh();
  put(s, 0, 4, 'seminarista', { under: ['acolito'], relics: [{ id: 'livro' }] });
  put(s, 0, 5, 'capela');
  put(s, 0, 6, 'acolito');
  put(s, 0, 7, 'acolito');
  const events = play(s, give(s, 0, 'monge'), { p: 0, slot: 4 });
  assert.equal(s.board[0][4].id, 'monge');
  assert.deepEqual(ids(s.players[0].retiro), ['acolito', 'livro', 'seminarista']);
  assert.ok(events.some(e => e.t === 'retire' && e.slot === 4 && e.id === 'seminarista'));
});

test('a zone holds at most 2 Monumentos per player', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 0, 1, 'scriptorium');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'capela'))), [4, 5, 6, 7, 8, 9, 10, 11]);
});

test('a Bispo in the zone makes room for one more Monumento', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 0, 1, 'scriptorium');
  put(s, 0, 3, 'bispo');
  assert.ok(slotsOf(E.legalPlays(s, 0, give(s, 0, 'capela'))).includes(2));
});

test('legalActions lists every play of the hand plus ending the turn', () => {
  const s = fresh();
  give(s, 0, 'acolito');
  const actions = E.legalActions(s);
  assert.equal(actions.filter(a => a.type === 'play').length, 12);
  assert.equal(actions.filter(a => a.type === 'end').length, 1);
});
