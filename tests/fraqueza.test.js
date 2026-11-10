import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, slotsOf } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];
const end = s => E.act(s, { type: 'end' });
const actives = s => E.legalActions(s).filter(a => a.type === 'active');

test('Tentação needs no Fraqueza and cannot choose Joana', () => {
  const s = fresh();
  put(s, 1, 0, 'cardeal');
  put(s, 1, 1, 'jo_santo');
  put(s, 1, 8, 'capela');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'tentacao'))), [0]);
});

test('Escândalo adds 3 Fraqueza to the enemy units adjacent to a weak target', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'padre');
  put(s, 1, 2, 'diacono');
  put(s, 1, 3, 'monge');
  put(s, 1, 8, 'bispo');
  put(s, 1, 9, 'capela');
  const uid = give(s, 0, 'escandalo');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 1, 2, 3]);
  play(s, uid, { p: 1, slot: 0 });
  assert.deepEqual([0, 1, 2, 3].map(slot => E.fraqOf(s, 1, slot)), [9, 9, 10, 8]);
  assert.equal(E.hasHeresy(s.board[1][1]), true);
});

test('Escândalo does not touch a Monumento beside the target', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'capela');
  play(s, give(s, 0, 'escandalo'), { p: 1, slot: 0 });
  assert.equal(E.hasHeresy(s.board[1][1]), false);
});

test('Cisma needs 12 enemy Fraqueza in the zone and stops the opponent from dominating it until the caster next turn', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  const uid = give(s, 0, 'cisma');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 1, 1, 'seminarista');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: { zone: 0 } }]);
  assert.equal(E.dominator(s, 0), 1);
  play(s, uid, { zone: 0 });
  assert.equal(E.dominator(s, 0), null);
  end(s);
  assert.equal(E.dominator(s, 0), null);
  end(s);
  assert.equal(E.dominator(s, 0), 1);
});

test('a zone under Cisma does not count for the majority of the opponent', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'seminarista');
  put(s, 1, 4, 'capela');
  play(s, give(s, 0, 'cisma'), { zone: 0 });
  end(s);
  end(s);
  assert.equal(s.players[1].fe, 0);
});

test('Cisma beats the domination taken by Joana and she cannot call it there', () => {
  const s = fresh();
  put(s, 1, 0, 'jo_santo');
  put(s, 1, 1, 'acolito');
  put(s, 1, 2, 'seminarista');
  s.forced[0] = 1;
  play(s, give(s, 0, 'cisma'), { zone: 0 });
  assert.equal(E.dominator(s, 0), null);
  s.forced[0] = null;
  end(s);
  s.players[1].sab = 9;
  assert.deepEqual(actives(s), []);
});

test('the Pregador gains 1 Fé for every 4 Fraqueza of the opponent in his zone, 4 at most', () => {
  const s = fresh();
  put(s, 0, 0, 'pregador');
  assert.equal(E.feOf(s, 0, 0), 2);
  put(s, 1, 0, 'acolito');
  assert.equal(E.feOf(s, 0, 0), 4);
  put(s, 1, 1, 'seminarista');
  assert.equal(E.feOf(s, 0, 0), 6);
  put(s, 1, 2, 'monge');
  assert.equal(E.feOf(s, 0, 0), 6);
  put(s, 1, 8, 'acolito');
  put(s, 0, 8, 'pregador', { silenced: 1 });
  assert.equal(E.feOf(s, 0, 8), 2);
});

test('the Pregador draws a card when he enters', () => {
  const s = fresh();
  s.players[0].deck = ['capela'];
  play(s, give(s, 0, 'pregador'), { p: 0, slot: 0 });
  assert.deepEqual(s.players[0].hand.map(c => c.id), ['capela']);
});

test('the Pregador and the Cavaleiro Templário read the Fraqueza shown for the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'pregador');
  put(s, 1, 0, 'padre');
  put(s, 1, 1, 'capela');
  put(s, 1, 2, 'acolito');
  assert.equal(E.zoneFraq(s, 1, 0), 12);
  assert.equal(E.feOf(s, 0, 0), 5);
  put(s, 0, 8, 'cavaleiro_templario');
  put(s, 0, 9, 'padre');
  put(s, 0, 11, 'capela');
  assert.equal(E.zoneFraq(s, 0, 2), 9);
  assert.equal(E.feOf(s, 0, 8), 2);
  put(s, 0, 10, 'igreja');
  assert.equal(E.zoneFraq(s, 0, 2), 7);
  s.board[0][8].fraqMod = -1;
  assert.deepEqual([E.zoneFraq(s, 0, 2), E.feOf(s, 0, 8)], [6, 5]);
});

test('the Mártir keeps enemy Heresias away from the units adjacent to him', () => {
  const s = fresh();
  put(s, 1, 0, 'martir');
  put(s, 1, 1, 'acolito');
  put(s, 1, 2, 'acolito');
  put(s, 1, 3, 'acolito');
  put(s, 1, 8, 'acolito');
  const uid = give(s, 0, 'tentacao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 3, 8]);
  assert.deepEqual([1, 3].map(slot => E.shielded(s, 1, slot)), [true, false]);
  s.board[1][0].silenced = 1;
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 1, 2, 3, 8]);
});

test('the Mártir gains 2 Fé each time a Heresia chooses him, 3 times at most', () => {
  const s = fresh();
  put(s, 1, 0, 'martir');
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const events = play(s, give(s, 0, 'tentacao'), { p: 1, slot: 0 });
    seen.push([E.feOf(s, 1, 0), events.some(e => e.t === 'trigger' && e.p === 1 && e.slot === 0 && e.id === 'martir')]);
  }
  assert.deepEqual(seen, [[5, true], [7, true], [9, true], [9, false]]);
  assert.equal(E.fraqOf(s, 1, 0), 9 + 3 + 5 + 5 + 5);
});

test('a Heresia that hits the whole zone does not feed the Mártir', () => {
  const s = fresh();
  put(s, 1, 0, 'martir');
  play(s, give(s, 0, 'propaganda'), { zone: 0 });
  assert.deepEqual(stats(s, 1, 0), [3, 10]);
});

test('the Inquisidor takes 2 Fé from the enemy units of his zone with 8 or more Fraqueza', () => {
  const s = fresh();
  put(s, 1, 0, 'seminarista', { feMod: 3 });
  put(s, 1, 1, 'padre');
  put(s, 1, 2, 'acolito');
  put(s, 1, 8, 'seminarista');
  put(s, 1, 3, 'capela');
  assert.deepEqual([0, 1, 2].map(slot => E.exposed(s, 1, slot)), [false, false, false]);
  put(s, 0, 0, 'inquisidor');
  assert.deepEqual([E.feOf(s, 1, 0), E.feOf(s, 1, 1), E.feOf(s, 1, 2), E.feOf(s, 1, 8), E.feOf(s, 1, 3)], [3, 5, 0, 2, 2]);
  assert.deepEqual([0, 1, 2].map(slot => E.exposed(s, 1, slot)), [true, false, true]);
  s.board[0][0].silenced = 1;
  assert.equal(E.feOf(s, 1, 0), 5);
});

test('the Inquisidor takes his 2 Fé after the Estandarte doubles the bearer', () => {
  const s = fresh();
  put(s, 0, 0, 'inquisidor');
  put(s, 1, 0, 'seminarista', { relics: [{ id: 'estandarte', rounds: 2 }] });
  assert.equal(E.feOf(s, 1, 0), 2);
});

test('Interrogar costs 1 Sabedoria and adds 2 Fraqueza to an enemy unit of his zone, 3 times at most', () => {
  const s = fresh();
  s.players[0].sab = 1;
  put(s, 0, 0, 'inquisidor');
  put(s, 1, 0, 'padre');
  put(s, 1, 1, 'jo_santo');
  put(s, 1, 2, 'frei', { relics: [{ id: 'armadura' }] });
  put(s, 1, 3, 'capela');
  put(s, 1, 8, 'padre');
  assert.deepEqual(actives(s), [{ type: 'active', slot: 0, at: { p: 1, slot: 0 } }]);
  E.act(s, { type: 'active', slot: 0, at: { p: 1, slot: 0 } });
  assert.deepEqual([s.players[0].sab, E.fraqOf(s, 1, 0), E.feOf(s, 1, 0), E.hasHeresy(s.board[1][0])], [0, 8, 2, true]);
  s.players[0].sab = 9;
  assert.deepEqual(actives(s), []);
  s.players[0].used = [];
  E.act(s, { type: 'active', slot: 0, at: { p: 1, slot: 0 } });
  s.players[0].used = [];
  E.act(s, { type: 'active', slot: 0, at: { p: 1, slot: 0 } });
  assert.equal(E.fraqOf(s, 1, 0), 12);
  s.players[0].used = [];
  assert.deepEqual(actives(s), []);
});

test('Graça na Fraqueza gives Fé equal to half the Fraqueza the unit has now, until the next turn', () => {
  const s = fresh();
  put(s, 0, 0, 'devoto');
  put(s, 0, 1, 'capela');
  const uid = give(s, 0, 'graca');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 0, slot: 0 });
  assert.deepEqual(stats(s, 0, 0), [6, 8]);
  s.board[0][0].hFraq = 4;
  assert.equal(E.feOf(s, 0, 0), 6);
  end(s);
  assert.equal(E.feOf(s, 0, 0), 6);
  end(s);
  assert.equal(E.feOf(s, 0, 0), 2);
});
