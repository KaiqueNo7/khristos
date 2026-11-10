import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, endRound, slotsOf } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];
const spellOf = events => events.find(e => e.t === 'spell');

test('Confissão needs a Padre and an Igreja on the board, removes every Heresia and gives 2 Fé', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { hFraq: 3, hFe: -1, silenced: 2, noFe: 1, drain: 2 });
  const uid = give(s, 0, 'confissao');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  assert.match(E.whyNot(s, 0, uid), /ministro/);
  put(s, 0, 8, 'padre');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  assert.match(E.whyNot(s, 0, uid), /lugar/);
  put(s, 0, 9, 'igreja');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  const events = play(s, uid, { p: 0, slot: 0 });
  assert.deepEqual(stats(s, 0, 0), [3, 9]);
  assert.equal(E.hasHeresy(s.board[0][0]), false);
  assert.deepEqual(spellOf(events), { t: 'spell', p: 0, id: 'confissao', uid, at: { p: 0, slot: 0 }, chain: 1, sacramento: true, minister: 8, place: 9 });
});

test('a unit without Heresias can also be confessed', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 1, 'padre');
  put(s, 0, 3, 'igreja');
  play(s, give(s, 0, 'confissao'), { p: 0, slot: 0 });
  assert.deepEqual(stats(s, 0, 0), [3, 9]);
});

test('a higher rank serves as minister and a higher temple as place', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 4, 'cardeal');
  put(s, 0, 8, 'basilica');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'confissao'))), [0]);
});

test('a lower rank does not serve as minister', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 4, 'diacono');
  put(s, 0, 8, 'igreja');
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'confissao')), []);
});

test('the minister of a Sacramento is never its own target', () => {
  const s = fresh();
  put(s, 0, 0, 'padre');
  put(s, 0, 8, 'igreja');
  const uid = give(s, 0, 'confissao');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 4, 'bispo');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 4]);
});

test('the minister standing in the zone of the target is named before one elsewhere', () => {
  const s = fresh();
  put(s, 0, 0, 'padre');
  put(s, 0, 8, 'padre');
  put(s, 0, 9, 'acolito');
  put(s, 0, 4, 'igreja');
  assert.deepEqual(E.sacramentStatus(s, 0, 'confissao', { p: 0, slot: 9 }), { minister: { need: 'padre', ok: true, slot: 8 }, place: { need: 'igreja', ok: true, slot: 4 } });
  assert.deepEqual(E.sacramentStatus(s, 0, 'confissao'), { minister: { need: 'padre', ok: true, slot: 0 }, place: { need: 'igreja', ok: true, slot: 4 } });
  assert.deepEqual(E.sacramentStatus(s, 1, 'confissao'), { minister: { need: 'padre', ok: false, slot: null }, place: { need: 'igreja', ok: false, slot: null } });
  assert.equal(E.sacramentStatus(s, 0, 'louvor'), null);
});

test('Crisma needs a Bispo and a Capela and gives 2 Fé and takes 2 Fraqueza from the units of the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 2, 'monge');
  put(s, 0, 8, 'capela');
  const uid = give(s, 0, 'crisma');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 4, 'bispo');
  assert.deepEqual(E.legalPlays(s, 0, uid).map(o => o.at.zone), [0, 1]);
  play(s, uid, { zone: 0 });
  assert.deepEqual([stats(s, 0, 0), stats(s, 0, 2)], [[3, 7], [4, 6]]);
});

test('Unção takes all the Fraqueza the unit has now and gives 1 Fé for every 3 removed', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'acolito');
  put(s, 0, 4, 'padre');
  s.players[0].doctrine = [0];
  play(s, give(s, 0, 'uncao'), { p: 0, slot: 0 });
  play(s, give(s, 0, 'uncao'), { p: 0, slot: 8 });
  assert.deepEqual([stats(s, 0, 0), stats(s, 0, 8)], [[3, 0], [4, 0]]);
  s.players[0].doctrine = [];
  assert.deepEqual([stats(s, 0, 0), stats(s, 0, 8)], [[3, 3], [4, 0]]);
});

test('an anointed unit that evolves never starts below zero Fraqueza', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { fraqMod: -9 });
  play(s, give(s, 0, 'seminarista'), { p: 0, slot: 0 });
  assert.equal(s.board[0][0].fraqMod, -8);
  s.board[0][0].hFraq = 3;
  assert.equal(E.fraqOf(s, 0, 0), 3);
});

test('the Catecúmeno gains 2 Fé whenever a Sacramento is celebrated in his zone', () => {
  const s = fresh();
  put(s, 0, 0, 'catecumeno');
  put(s, 0, 1, 'acolito');
  put(s, 0, 8, 'acolito');
  put(s, 0, 4, 'padre');
  put(s, 0, 5, 'igreja');
  const events = play(s, give(s, 0, 'batismo'), { p: 0, slot: 0 });
  assert.deepEqual(stats(s, 0, 0), [4, 6]);
  assert.deepEqual(events[events.length - 1], { t: 'trigger', p: 0, slot: 0, id: 'catecumeno' });
  play(s, give(s, 0, 'confissao'), { p: 0, slot: 1 });
  assert.equal(E.feOf(s, 0, 0), 6);
  assert.equal(play(s, give(s, 0, 'confissao'), { p: 0, slot: 8 }).some(e => e.t === 'trigger'), false);
  assert.equal(E.feOf(s, 0, 0), 6);
});

test('the first card of a turn opens the chain without Fervor', () => {
  const s = fresh();
  put(s, 1, 0, 'padre');
  assert.equal(E.fervorReady(s, 0), false);
  const uid = give(s, 0, 'tentacao');
  const events = play(s, uid, { p: 1, slot: 0 });
  assert.equal(E.fraqOf(s, 1, 0), 9);
  assert.deepEqual(spellOf(events), { t: 'spell', p: 0, id: 'tentacao', uid, at: { p: 1, slot: 0 }, chain: 1 });
  assert.equal(E.fervorReady(s, 0), true);
});

test('a Fervor card played after another card of the turn gets its bonus', () => {
  const s = fresh();
  put(s, 1, 0, 'padre');
  play(s, give(s, 0, 'capela'), { p: 0, slot: 0 });
  const uid = give(s, 0, 'tentacao');
  const events = play(s, uid, { p: 1, slot: 0 });
  assert.equal(E.fraqOf(s, 1, 0), 11);
  assert.deepEqual(spellOf(events), { t: 'spell', p: 0, id: 'tentacao', uid, at: { p: 1, slot: 0 }, chain: 2, fervor: true });
});

test('Tentação with Fervor also draws a card, and without Fervor it does not', () => {
  const s = fresh();
  put(s, 1, 0, 'padre');
  s.players[0].deck = ['igreja', 'capela'];
  play(s, give(s, 0, 'tentacao'), { p: 1, slot: 0 });
  assert.deepEqual(s.players[0].hand.map(c => c.id), []);
  play(s, give(s, 0, 'tentacao'), { p: 1, slot: 0 });
  assert.deepEqual(s.players[0].hand.map(c => c.id), ['capela']);
});

test('Louvor with Fervor gives 3 Fé instead of 2', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  play(s, give(s, 0, 'capela'), { p: 0, slot: 8 });
  play(s, give(s, 0, 'louvor'), { zone: 0 });
  assert.equal(E.feOf(s, 0, 0), 4);
});

test('Cruzada with Fervor gives 3 Fé instead of 2', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  play(s, give(s, 0, 'capela'), { p: 0, slot: 8 });
  play(s, give(s, 0, 'cruzada'), {});
  assert.deepEqual(stats(s, 0, 0), [4, 10]);
});

test('Te Deum gives 1 Fé, and with Fervor 1 more for every card already played this turn', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'acolito');
  const first = give(s, 0, 'te_deum');
  assert.deepEqual(E.legalPlays(s, 0, first).map(o => o.at.zone), [0, 2]);
  assert.equal(spellOf(play(s, first, { zone: 0 })).level, undefined);
  assert.equal(E.feOf(s, 0, 0), 2);
  play(s, give(s, 0, 'capela'), { p: 0, slot: 4 });
  const events = play(s, give(s, 0, 'te_deum'), { zone: 2 });
  assert.equal(E.feOf(s, 0, 8), 4);
  assert.deepEqual([spellOf(events).chain, spellOf(events).fervor, spellOf(events).level], [3, true, 2]);
  endRound(s);
  assert.deepEqual([E.feOf(s, 0, 0), E.feOf(s, 0, 8)], [1, 1]);
});

test('the Cavaleiro Templário played with Fervor enters with 2 less Fraqueza', () => {
  const s = fresh();
  const cold = play(s, give(s, 0, 'cavaleiro_templario'), { p: 0, slot: 0 });
  const warm = play(s, give(s, 0, 'cavaleiro_templario'), { p: 0, slot: 8 });
  assert.deepEqual([E.fraqOf(s, 0, 0), E.fraqOf(s, 0, 8)], [6, 4]);
  assert.deepEqual([cold[0].fervor, warm[0].fervor, warm[0].chain], [undefined, true, 2]);
});

test('relics and evolutions also count in the chain, actives do not', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 0, 1, 'acolito');
  put(s, 0, 4, 'sta_santo');
  E.act(s, { type: 'active', slot: 4 });
  assert.equal(s.players[0].played, 0);
  assert.equal(play(s, give(s, 0, 'calice'), { p: 0, slot: 0 })[0].chain, 1);
  assert.equal(play(s, give(s, 0, 'seminarista'), { p: 0, slot: 1 })[0].chain, 2);
});

test('Consagração counts as one card and its temple repeats the chain number', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  s.players[0].deck = ['igreja'];
  const events = play(s, give(s, 0, 'consagracao'), { p: 0, slot: 0 });
  assert.deepEqual([spellOf(events).chain, events.find(e => e.t === 'evolve').chain, s.players[0].played], [1, 1, 1]);
});

test('the chain starts again every turn', () => {
  const s = fresh();
  play(s, give(s, 0, 'capela'), { p: 0, slot: 0 });
  endRound(s);
  assert.equal(s.players[0].played, 0);
  assert.equal(E.fervorReady(s, 0), false);
});
