import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put } from './helpers.js';
import { chooseAction, chooseMulligan } from '../js/ai.js';

test('the AI plays an affordable unit instead of passing', () => {
  const s = fresh();
  const uid = give(s, 0, 'acolito');
  const action = chooseAction(s);
  assert.equal(action.type, 'play');
  assert.equal(action.uid, uid);
});

test('the AI passes when nothing can be played', () => {
  const s = fresh();
  give(s, 0, 'padre');
  assert.deepEqual(chooseAction(s), { type: 'end' });
});

test('the AI evolves a unit when it holds the next card of the line', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  const uid = give(s, 0, 'seminarista');
  const action = chooseAction(s);
  assert.deepEqual([action.type, action.uid, action.at], ['play', uid, { p: 0, slot: 0 }]);
});

test('the AI climbs the line even when the next step adds no Fé right away', () => {
  const s = fresh();
  put(s, 0, 0, 'seminarista');
  put(s, 0, 1, 'capela');
  const uid = give(s, 0, 'diacono');
  assert.deepEqual(chooseAction(s), { type: 'play', uid, at: { p: 0, slot: 0 } });
});

test('the AI does not replace a strong card with a weak one', () => {
  const s = fresh();
  for (let slot = 0; slot < 12; slot++) put(s, 0, slot, 'mosteiro_beneditino');
  give(s, 0, 'acolito');
  assert.deepEqual(chooseAction(s), { type: 'end' });
});

test('the AI mulligan keeps cheap base cards and swaps the rest', () => {
  const s = E.newGame({ decks: ['aq', 'jo'], seed: 5 });
  s.players[0].hand = [];
  const keep = [E.toHand(s, 0, 'acolito').uid, E.toHand(s, 0, 'capela').uid];
  const swap = [E.toHand(s, 0, 'cardeal').uid, E.toHand(s, 0, 'padre').uid, E.toHand(s, 0, 'sta_santo').uid];
  const chosen = chooseMulligan(s, 0);
  assert.deepEqual([...chosen].sort((a, b) => a - b), swap);
  assert.ok(keep.every(uid => !chosen.includes(uid)));
});

test('the AI takes the majority when one card gives it', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 1, 8, 'capela');
  give(s, 0, 'capela');
  const action = chooseAction(s);
  assert.equal(action.type, 'play');
  assert.notEqual(E.zoneOf(action.at.slot), 0);
});

test('the AI opens the chain with another card before a Fervor card', () => {
  const s = fresh();
  s.players[0].sab = 4;
  put(s, 0, 0, 'acolito');
  put(s, 0, 1, 'acolito');
  put(s, 0, 4, 'capela');
  put(s, 1, 0, 'igreja');
  const louvor = give(s, 0, 'louvor');
  const relicario = give(s, 0, 'relicario');
  assert.equal(chooseAction(s).uid, relicario);
  s.players[0].sab = 3;
  assert.equal(chooseAction(s).uid, louvor);
});

test('the AI celebrates a Sacramento when minister and place are on the board', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  put(s, 0, 4, 'padre');
  put(s, 0, 5, 'igreja');
  const uid = give(s, 0, 'confissao');
  assert.equal(chooseAction(s).uid, uid);
});

for (const seed of [1, 2, 3, 4, 5, 6]) {
  test(`a full AI against AI match with seed ${seed} ends inside the round limit`, () => {
    const s = E.newGame({ decks: seed % 2 ? ['aq', 'jo'] : ['jo', 'aq'], seed, first: seed % 2 });
    E.mulligan(s, 0, chooseMulligan(s, 0));
    E.mulligan(s, 1, chooseMulligan(s, 1));
    let steps = 0;
    while (s.phase === 'main' && steps++ < 5000) E.act(s, chooseAction(s));
    assert.equal(s.phase, 'over');
    assert.ok([0, 1, null].includes(s.winner));
    assert.ok(s.round <= s.rules.lastRound + 3);
  });
}
