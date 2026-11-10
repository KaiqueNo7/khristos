import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play, endRound, slotsOf, ids } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];
const handIds = (s, p) => s.players[p].hand.map(c => c.id);

test('Oração das Vésperas needs domination, takes 2 Fraqueza from the zone units and draws 1', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 1, 0, 'catedral');
  const uid = give(s, 0, 'vesperas');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  s.board[1][0] = null;
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: { zone: 0 } }]);
  s.players[0].deck = ['capela'];
  const events = play(s, uid, { zone: 0 });
  assert.equal(E.fraqOf(s, 0, 0), 7);
  assert.deepEqual(handIds(s, 0), ['capela']);
  assert.deepEqual(s.players[0].retiro, ['vesperas']);
  assert.ok(events.some(e => e.t === 'spell' && e.p === 0 && e.id === 'vesperas' && e.at.zone === 0));
});

test('Eucaristia needs a Padre on the board and a Monumento with the Cálice in the zone, and gives it 10 Fé until the next turn', () => {
  const s = fresh();
  put(s, 0, 0, 'capela', { relics: [{ id: 'calice' }] });
  put(s, 0, 8, 'capela');
  const uid = give(s, 0, 'eucaristia');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 9, 'padre');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: { zone: 0 } }]);
  const events = play(s, uid, { zone: 0 });
  assert.deepEqual(events.find(e => e.t === 'spell'), { t: 'spell', p: 0, id: 'eucaristia', uid, at: { zone: 0 }, chain: 1, sacramento: true, minister: 9, place: null, target: 0 });
  assert.equal(E.feOf(s, 0, 0), 14);
  E.act(s, { type: 'end' });
  assert.equal(E.feOf(s, 0, 0), 14);
  E.act(s, { type: 'end' });
  assert.equal(E.feOf(s, 0, 0), 4);
});

test('Revelação Divina needs a dominated zone with 8 Fé and draws 3', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  const uid = give(s, 0, 'revelacao');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 1, 'capela');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: { zone: 0 } }]);
  s.players[0].deck = ['acolito', 'capela', 'igreja', 'padre'];
  play(s, uid, { zone: 0 });
  assert.equal(s.players[0].hand.length, 3);
  assert.equal(s.players[0].deck.length, 1);
});

test('Batismo needs a Diácono and a Capela on the board and gives 1 Fé and takes 3 Fraqueza', () => {
  const s = fresh();
  put(s, 0, 8, 'capela');
  put(s, 0, 1, 'diacono');
  put(s, 0, 3, 'acolito');
  const uid = give(s, 0, 'batismo');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [3]);
  play(s, uid, { p: 0, slot: 3 });
  assert.deepEqual(stats(s, 0, 3), [2, 6]);
});

test('Batismo is not available without a Diácono or higher, nor without a temple', () => {
  const s = fresh();
  put(s, 0, 0, 'igreja');
  put(s, 0, 3, 'acolito');
  const uid = give(s, 0, 'batismo');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  assert.match(E.whyNot(s, 0, uid), /ministro/);
  s.board[0][0] = null;
  put(s, 0, 1, 'padre');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  assert.match(E.whyNot(s, 0, uid), /lugar/);
});

test('Pentecostes needs the Zona Central and strengthens every allied unit', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 1, 0, 'acolito');
  const uid = give(s, 0, 'pentecoste');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 4, 'capela');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: {} }]);
  play(s, uid);
  assert.deepEqual(stats(s, 0, 0), [3, 7]);
  assert.deepEqual(stats(s, 1, 0), [1, 9]);
});

test('Consagração puts the next temple from the deck on top of the Monumento for its own cost only', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  s.players[0].deck = ['igreja', 'acolito'];
  s.players[0].sab = 4;
  const uid = give(s, 0, 'consagracao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 0, slot: 0 });
  assert.equal(s.board[0][0].id, 'igreja');
  assert.deepEqual(s.board[0][0].under, ['capela']);
  assert.deepEqual(s.players[0].deck, ['acolito']);
  assert.equal(s.players[0].sab, 0);
});

test('Consagração takes the next temple from the hand when the deck has none', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  give(s, 0, 'igreja');
  play(s, give(s, 0, 'consagracao'), { p: 0, slot: 0 });
  assert.equal(s.board[0][0].id, 'igreja');
  assert.deepEqual(handIds(s, 0), []);
});

test('Consagração is not available without the next temple or without domination', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  const uid = give(s, 0, 'consagracao');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  s.players[0].deck = ['igreja'];
  put(s, 1, 0, 'catedral');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
});

test('Ordenação fetches the evolution of the target unit from the deck', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 1, 'monge');
  s.players[0].deck = ['capela', 'seminarista'];
  const uid = give(s, 0, 'ordenacao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 0, slot: 0 });
  assert.deepEqual(handIds(s, 0), ['seminarista']);
  assert.deepEqual(s.players[0].deck, ['capela']);
});

test('Louvor gives 2 Fé to the units of one zone until its owner next turn', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'acolito');
  const uid = give(s, 0, 'louvor');
  assert.deepEqual(E.legalPlays(s, 0, uid).map(o => o.at.zone), [0, 2]);
  play(s, uid, { zone: 0 });
  assert.deepEqual([E.feOf(s, 0, 0), E.feOf(s, 0, 8)], [3, 1]);
  E.act(s, { type: 'end' });
  assert.equal(E.feOf(s, 0, 0), 3);
  E.act(s, { type: 'end' });
  assert.equal(E.feOf(s, 0, 0), 1);
});

test('Cruzada gives 2 Fé until the next turn and 1 Fraqueza for good to every allied unit', () => {
  const s = fresh();
  const uid = give(s, 0, 'cruzada');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 0, 0, 'acolito');
  put(s, 0, 8, 'seminarista');
  put(s, 0, 9, 'capela');
  play(s, uid, {});
  assert.deepEqual([stats(s, 0, 0), stats(s, 0, 8), stats(s, 0, 9)], [[3, 10], [5, 9], [2, 0]]);
  endRound(s);
  assert.deepEqual([stats(s, 0, 0), stats(s, 0, 8)], [[1, 10], [3, 9]]);
});

test('Inquisição destroys a weak enemy unit that is not at the top of its line', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 1, 'catedral');
  put(s, 1, 0, 'acolito', { relics: [{ id: 'relicario' }] });
  put(s, 1, 1, 'monge');
  put(s, 1, 3, 'padre');
  put(s, 1, 2, 'frei', { hFraq: 3 });
  const uid = give(s, 0, 'inquisicao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 1]);
  const events = play(s, uid, { p: 1, slot: 0 });
  assert.equal(s.board[1][0], null);
  assert.deepEqual(ids(s.players[1].retiro), ['acolito', 'relicario']);
  assert.deepEqual(s.players[0].retiro, ['inquisicao']);
  assert.ok(events.some(e => e.t === 'destroy' && e.p === 1 && e.slot === 0 && e.id === 'acolito'));
  assert.deepEqual(events.find(e => e.t === 'spell'), { t: 'spell', p: 0, id: 'inquisicao', uid, at: { p: 1, slot: 0 }, chain: 1 });
});

test('Inquisição needs domination of the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'monge');
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'inquisicao')), []);
});

test('Inquisição cannot touch a Santo or a Cardeal', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 1, 'catedral');
  put(s, 0, 3, 'basilica');
  put(s, 1, 0, 'jo_santo', { hFraq: 5 });
  put(s, 1, 1, 'cardeal', { hFraq: 6 });
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'inquisicao')), []);
});

test('Debate Filosófico silences the target for 2 rounds and takes 1 Fé', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 1, 'acolito');
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'seminarista');
  put(s, 1, 3, 'capela');
  const uid = give(s, 0, 'debate');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 1]);
  play(s, uid, { p: 1, slot: 1 });
  assert.equal(E.feOf(s, 1, 1), 1);
  endRound(s);
  assert.equal(E.feOf(s, 1, 1), 1);
  endRound(s);
  assert.equal(E.feOf(s, 1, 1), 2);
});

test('Debate Filosófico needs 3 units in the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 1, 'acolito');
  put(s, 1, 1, 'seminarista');
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'debate')), []);
});

test('Debate Filosófico needs less Fraqueza than the opponent in the zone', () => {
  const s = fresh();
  put(s, 0, 0, 'catedral');
  put(s, 0, 1, 'acolito');
  put(s, 0, 3, 'acolito');
  put(s, 1, 0, 'seminarista');
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'debate')), []);
});

test('Exposição de Heresia adds 3 Fraqueza to a unit with 6 or more', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'cardeal');
  const uid = give(s, 0, 'exposicao_aq');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 1, slot: 0 });
  assert.equal(E.fraqOf(s, 1, 0), 12);
});

test('Simonia takes 2 Fé from a unit in a zone with 5 enemy Fraqueza', () => {
  const s = fresh();
  put(s, 1, 0, 'seminarista');
  put(s, 1, 8, 'cardeal');
  const uid = give(s, 0, 'simonia');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 1, slot: 0 });
  assert.equal(E.feOf(s, 1, 0), 0);
});

test('Heresia Albigense takes 3 Fé from a Monumento for 3 rounds', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'seminarista');
  put(s, 1, 2, 'igreja');
  const uid = give(s, 0, 'heresia_alb');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [2]);
  play(s, uid, { p: 1, slot: 2 });
  assert.equal(E.feOf(s, 1, 2), 1);
  endRound(s);
  endRound(s);
  assert.equal(E.feOf(s, 1, 2), 1);
  endRound(s);
  assert.equal(E.feOf(s, 1, 2), 4);
});

test('Apostasia makes the opponent lose Fé equal to the target Fraqueza, 10 at most', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'bispo');
  put(s, 1, 8, 'acolito', { hFraq: 8 });
  s.players[1].fe = 30;
  const uid = give(s, 0, 'exposicao_jo');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0, 8]);
  play(s, uid, { p: 1, slot: 0 });
  assert.equal(s.players[1].fe, 21);
  play(s, give(s, 0, 'exposicao_jo'), { p: 1, slot: 8 });
  assert.equal(s.players[1].fe, 11);
  s.players[1].fe = 5;
  play(s, give(s, 0, 'exposicao_jo'), { p: 1, slot: 0 });
  assert.equal(s.players[1].fe, 0);
});

test('Iconoclastia destroys a relic of an enemy card in a dominated zone', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 1, 0, 'acolito', { relics: [{ id: 'relicario' }] });
  put(s, 1, 1, 'seminarista');
  const uid = give(s, 0, 'iconoclastia');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 1, slot: 0 });
  assert.deepEqual(s.board[1][0].relics, []);
  assert.deepEqual(s.players[1].retiro, ['relicario']);
});

test('Heresias cannot target Joana, not even to take her relics', () => {
  const s = fresh();
  put(s, 0, 0, 'catedral');
  put(s, 0, 1, 'mosteiro_beneditino');
  put(s, 1, 0, 'jo_santo', { relics: [{ id: 'cruz_joana' }], hFraq: 6 });
  assert.deepEqual(E.legalPlays(s, 0, give(s, 0, 'iconoclastia')), []);
});

test('whyNot explains an unplayable card and stays silent for a playable one', () => {
  const s = fresh();
  const padre = give(s, 0, 'padre');
  const acolito = give(s, 0, 'acolito');
  assert.equal(typeof E.whyNot(s, 0, padre), 'string');
  assert.equal(E.whyNot(s, 0, acolito), null);
});

test('Acusação de Bruxaria stops a unit from generating Fé for 2 rounds', () => {
  const s = fresh();
  put(s, 1, 0, 'seminarista');
  put(s, 1, 1, 'bispo');
  const uid = give(s, 0, 'acusacao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [0]);
  play(s, uid, { p: 1, slot: 0 });
  assert.equal(E.feOf(s, 1, 0), 0);
  endRound(s);
  assert.equal(E.feOf(s, 1, 0), 0);
  endRound(s);
  assert.equal(E.feOf(s, 1, 0), 2);
});

test('Propaganda Pagã adds 1 Fraqueza to the enemy units of the zone and takes 1 Fé for every 4 Fraqueza there', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'seminarista');
  s.players[1].fe = 9;
  const uid = give(s, 0, 'propaganda');
  assert.deepEqual(E.legalPlays(s, 0, uid), [{ kind: 'spell', at: { zone: 0 } }]);
  play(s, uid, { zone: 0 });
  assert.deepEqual([E.fraqOf(s, 1, 0), E.fraqOf(s, 1, 1)], [10, 9]);
  assert.equal(s.players[1].fe, 5);
});

test('Profanação do Altar destroys an enemy Monumento, but not the Catedral', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 4, 'mosteiro_beneditino');
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'acolito');
  put(s, 1, 3, 'capela');
  put(s, 1, 8, 'seminarista');
  put(s, 1, 9, 'catedral');
  const uid = give(s, 0, 'profanacao');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [3]);
  play(s, uid, { p: 1, slot: 3 });
  assert.equal(s.board[1][3], null);
  assert.deepEqual(s.players[1].retiro, ['capela']);
});

test('Profanação do Altar needs 20 enemy Fraqueza on the board', () => {
  const s = fresh();
  put(s, 1, 0, 'acolito');
  put(s, 1, 1, 'acolito');
  put(s, 1, 3, 'capela');
  const uid = give(s, 0, 'profanacao');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  put(s, 1, 8, 'seminarista');
  assert.deepEqual(slotsOf(E.legalPlays(s, 0, uid)), [3]);
});
