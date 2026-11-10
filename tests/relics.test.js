import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, endRound, slotsOf } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];

test('the Cálice Sagrado equips on a Monumento, not on a unit', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 0, 1, 'acolito');
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'calice')), [{ kind: 'equip', at: { p: 0, slot: 0 } }]);
});

test('equipping attaches the relic to the card and pays its cost', () => {
  const s = fresh();
  s.players[0].sab = 3;
  put(s, 0, 0, 'capela');
  const uid = give(s, 0, 'calice');
  const events = play(s, uid, { p: 0, slot: 0 });
  assert.deepEqual(s.board[0][0].relics.map(r => r.id), ['calice']);
  assert.equal(E.feOf(s, 0, 0), 4);
  assert.equal(s.players[0].sab, 0);
  assert.deepEqual(s.players[0].retiro, []);
  assert.deepEqual(events.find(e => e.t === 'equip'), { t: 'equip', p: 0, slot: 0, id: 'calice', uid, chain: 1 });
});

test('a card holds as many relics as its slots', () => {
  const s = fresh();
  put(s, 0, 0, 'capela', { relics: [{ id: 'calice' }] });
  put(s, 0, 8, 'basilica', { relics: [{ id: 'calice' }] });
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, give(s, 0, 'icone'))), [8]);
});

test('the Suma Teológica gives 1 Fé and takes 3 Fraqueza', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { relics: [{ id: 'livro' }] });
  assert.deepEqual(stats(s, 0, 0), [2, 6]);
});

test('the Relicário gives 2 Fé', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { relics: [{ id: 'relicario' }] });
  assert.equal(E.feOf(s, 0, 0), 3);
});

test('the Ícone gives 1 Fé to its bearer and to adjacent allies only', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito', { relics: [{ id: 'icone' }] });
  put(s, 0, 1, 'acolito');
  put(s, 0, 2, 'acolito');
  put(s, 0, 3, 'acolito');
  assert.deepEqual([0, 1, 2, 3].map(slot => E.feOf(s, 0, slot)), [2, 2, 2, 1]);
});

test('the Cruz de Joana equips only on Joana and gives 1 Fé per allied unit', () => {
  const s = fresh();
  put(s, 0, 0, 'jo_santo');
  put(s, 0, 1, 'sta_santo');
  put(s, 0, 8, 'acolito');
  put(s, 0, 9, 'acolito');
  const uid = give(s, 0, 'cruz_joana');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 0, slot: 0 });
  assert.equal(E.feOf(s, 0, 0), 9);
});

test('the Armadura gives 2 Fé and blocks any increase of Fraqueza', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito', { relics: [{ id: 'armadura' }] });
  put(s, 0, 1, 'jo_santo');
  assert.deepEqual(stats(s, 1, 0), [3, 9]);
  play(s, give(s, 0, 'exposicao_aq'), { p: 1, slot: 0 });
  assert.equal(E.fraqOf(s, 1, 0), 9);
});

test('the Estandarte doubles the Fé of its bearer for 2 rounds and then goes to the Retiro', () => {
  const s = fresh();
  put(s, 0, 0, 'jo_santo', { relics: [{ id: 'armadura' }] });
  play(s, give(s, 0, 'estandarte'), { p: 0, slot: 0 });
  assert.equal(E.feOf(s, 0, 0), 18);
  endRound(s);
  assert.equal(E.feOf(s, 0, 0), 18);
  endRound(s);
  assert.equal(E.feOf(s, 0, 0), 9);
  assert.deepEqual(s.players[0].retiro, ['estandarte']);
});

test('the Manto protects from Heresias until its owner next turn, then goes to the Retiro', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  play(s, give(s, 0, 'manto'), { p: 0, slot: 0 });
  E.act(s, { type: 'end' });
  s.players[1].sab = 99;
  assert.deepEqual(E.legalPlays(s, 1, give(s, 1, 'exposicao_jo')), []);
  E.act(s, { type: 'end' });
  assert.deepEqual(s.board[0][0].relics, []);
  assert.deepEqual(s.players[0].retiro, ['manto']);
});
