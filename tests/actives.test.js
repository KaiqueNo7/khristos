import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, endRound, ids } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];
const handIds = (s, p) => s.players[p].hand.map(c => c.id);
const actives = s => E.legalActions(s).filter(a => a.type === 'active');

test('São Tomás in the Zona Central teaches the three zones until his next turn and discounts Sacramentos this turn', () => {
  const s = fresh();
  s.players[0].sab = 5;
  put(s, 0, 4, 'sta_santo');
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'acolito');
  assert.deepEqual(actives(s).map(a => a.slot), [4]);
  const events = E.act(s, { type: 'active', slot: 4 });
  assert.equal(s.players[0].sab, 3);
  assert.deepEqual([E.fraqOf(s, 0, 0), E.fraqOf(s, 0, 8)], [6, 6]);
  assert.deepEqual([E.costOf(s, 0, 'confissao'), E.costOf(s, 0, 'monge')], [1, 2]);
  assert.ok(events.some(e => e.t === 'active' && e.p === 0 && e.slot === 4 && e.id === 'sta_santo'));
  E.act(s, { type: 'end' });
  assert.equal(E.fraqOf(s, 0, 0), 6);
  E.act(s, { type: 'end' });
  assert.equal(E.fraqOf(s, 0, 0), 9);
  assert.equal(E.costOf(s, 0, 'confissao'), 2);
});

test('São Tomás in a lateral zone teaches only that zone', () => {
  const s = fresh();
  put(s, 0, 1, 'sta_santo');
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'acolito');
  E.act(s, { type: 'active', slot: 1 });
  assert.deepEqual([E.fraqOf(s, 0, 0), E.fraqOf(s, 0, 8)], [6, 9]);
});

test('an active can be used once per turn', () => {
  const s = fresh();
  put(s, 0, 4, 'sta_santo');
  E.act(s, { type: 'active', slot: 4 });
  assert.deepEqual(actives(s), []);
  assert.throws(() => E.act(s, { type: 'active', slot: 4 }));
  endRound(s);
  assert.deepEqual(actives(s).map(a => a.slot), [4]);
});

test('with São Tomás in play, allied units enter with 2 less Fraqueza', () => {
  const s = fresh();
  put(s, 0, 4, 'sta_santo');
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 0 });
  assert.equal(E.fraqOf(s, 0, 0), 7);
});

test('the welcome of São Tomás is given once: evolving does not repeat it', () => {
  const s = fresh();
  put(s, 0, 4, 'sta_santo');
  put(s, 0, 0, 'acolito', { fraqMod: -2 });
  play(s, give(s, 0, 'seminarista'), { p: 0, slot: 0 });
  assert.equal(E.fraqOf(s, 0, 0), 6);
});

test('Joana pays 2 Sabedoria to dominate her zone until the end of her turn', () => {
  const s = fresh();
  s.players[0].sab = 2;
  put(s, 0, 0, 'jo_santo');
  put(s, 1, 0, 'catedral');
  assert.equal(E.dominator(s, 0), 1);
  E.act(s, { type: 'active', slot: 0 });
  assert.equal(s.players[0].sab, 0);
  assert.equal(E.dominator(s, 0), 0);
  E.act(s, { type: 'end' });
  assert.equal(E.dominator(s, 0), 1);
});

test('the Diácono pays 1 Sabedoria to fetch a Bênção from the deck', () => {
  const s = fresh();
  put(s, 0, 0, 'diacono');
  s.players[0].deck = ['capela', 'vesperas', 'acolito'];
  s.players[0].sab = 1;
  E.act(s, { type: 'active', slot: 0 });
  assert.deepEqual(handIds(s, 0), ['vesperas']);
  assert.deepEqual(ids(s.players[0].deck), ['acolito', 'capela']);
  assert.equal(s.players[0].sab, 0);
});

test('the Diácono active is not offered without Sabedoria or without a Bênção in the deck', () => {
  const s = fresh();
  put(s, 0, 0, 'diacono');
  s.players[0].deck = ['vesperas'];
  s.players[0].sab = 0;
  assert.deepEqual(actives(s), []);
  s.players[0].sab = 1;
  s.players[0].deck = ['capela'];
  assert.deepEqual(actives(s), []);
});

test('the Devoto fetches a Santo from the deck', () => {
  const s = fresh();
  put(s, 0, 0, 'devoto');
  s.players[0].deck = ['capela', 'jo_santo'];
  E.act(s, { type: 'active', slot: 0 });
  assert.deepEqual(handIds(s, 0), ['jo_santo']);
  assert.deepEqual(s.players[0].deck, ['capela']);
});

test('the Devoto active is not offered when the deck has no Santo', () => {
  const s = fresh();
  put(s, 0, 0, 'devoto');
  s.players[0].deck = ['capela'];
  assert.deepEqual(actives(s), []);
});

test('the Frei moves to a free slot of a neighbouring zone and grows with the journey', () => {
  const s = fresh();
  put(s, 0, 3, 'frei');
  assert.deepEqual(actives(s).map(a => a.at.slot), [4, 5, 6, 7]);
  const events = E.act(s, { type: 'active', slot: 3, at: { p: 0, slot: 4 } });
  assert.equal(s.board[0][3], null);
  assert.equal(s.board[0][4].id, 'frei');
  assert.deepEqual(stats(s, 0, 4), [4, 6]);
  assert.ok(events.some(e => e.t === 'move' && e.p === 0 && e.from === 3 && e.to === 4));
  endRound(s);
  assert.deepEqual(actives(s).map(a => a.at.slot), [0, 1, 2, 3, 8, 9, 10, 11]);
});

test('the Frei stops growing after 8 journeys', () => {
  const s = fresh();
  put(s, 0, 3, 'frei', { moves: 8, feMod: 8, fraqMod: -8 });
  E.act(s, { type: 'active', slot: 3, at: { p: 0, slot: 4 } });
  assert.deepEqual([s.board[0][4].feMod, s.board[0][4].fraqMod], [8, -8]);
});

test('Vocação: the Acólito fetches a Seminarista from the deck when it enters', () => {
  const s = fresh();
  s.players[0].deck = ['capela', 'seminarista'];
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), ['seminarista']);
  assert.deepEqual(s.players[0].deck, ['capela']);
});

test('Vocação also answers when the card enters by evolution', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  s.players[0].deck = ['diacono', 'capela'];
  play(s, give(s, 0, 'seminarista'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), ['diacono']);
});

test('Vocação stays quiet when the next card is not in the deck', () => {
  const s = fresh();
  s.players[0].deck = ['capela'];
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), []);
  assert.deepEqual(s.players[0].deck, ['capela']);
});

test('the Padre has no Vocação: a Bispo has to be drawn or ordained', () => {
  const s = fresh();
  put(s, 0, 0, 'diacono');
  put(s, 0, 1, 'capela');
  s.players[0].deck = ['bispo'];
  play(s, give(s, 0, 'padre'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), []);
});

test('the Monge Copista fetches an Acólito from the deck when it enters', () => {
  const s = fresh();
  s.players[0].deck = ['acolito', 'capela'];
  play(s, give(s, 0, 'monge'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), ['acolito']);
  assert.deepEqual(s.players[0].deck, ['capela']);
});

test('without an Acólito in the deck the Monge Copista draws a card', () => {
  const s = fresh();
  s.players[0].deck = ['capela'];
  play(s, give(s, 0, 'monge'), { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), ['capela']);
});

test('the Scriptorium draws when its owner plays or evolves a unit in its zone', () => {
  const s = fresh();
  put(s, 0, 0, 'scriptorium');
  put(s, 0, 1, 'acolito');
  s.players[0].deck = ['capela', 'igreja', 'padre'];
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 8 });
  assert.equal(s.players[0].hand.length, 0);
  play(s, give(s, 0, 'devoto'), { p: 0, slot: 3 });
  assert.equal(s.players[0].hand.length, 1);
  play(s, give(s, 0, 'seminarista'), { p: 0, slot: 1 });
  assert.equal(s.players[0].hand.length, 2);
});

test('the Missionário draws once per turn when the opponent plays a unit in its zone', () => {
  const s = fresh();
  put(s, 1, 0, 'missionario');
  s.players[1].deck = ['capela', 'igreja'];
  play(s, give(s, 0, 'capela'), { p: 0, slot: 3 });
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 8 });
  assert.equal(s.players[1].hand.length, 0);
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 0 });
  assert.equal(s.players[1].hand.length, 1);
  play(s, give(s, 0, 'acolito'), { p: 0, slot: 1 });
  assert.equal(s.players[1].hand.length, 1);
});

test('the Convento gives 1 Sabedoria at the start of the turn when its zone is full', () => {
  const s = fresh({ round: 3 });
  put(s, 0, 4, 'convento');
  put(s, 0, 5, 'acolito');
  put(s, 0, 6, 'acolito');
  put(s, 0, 7, 'acolito');
  endRound(s);
  assert.equal(s.players[0].sab, 5);
  s.board[0][5] = null;
  endRound(s);
  assert.equal(s.players[0].sab, 5);
});
