import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, started, fresh, give, play, endRound } from './helpers.js';

test('a new game deals 5 cards to each player and waits for the mulligan', () => {
  const s = E.newGame({ decks: ['aq', 'jo'], seed: 3 });
  assert.equal(s.phase, 'mulligan');
  assert.deepEqual(s.players.map(p => p.hand.length), [5, 5]);
  assert.deepEqual(s.players.map(p => p.deck.length), [25, 25]);
});

test('the mulligan swaps the chosen cards and keeps the hand at 5', () => {
  const s = E.newGame({ decks: ['aq', 'jo'], seed: 3 });
  const out = s.players[0].hand.slice(0, 2).map(c => c.uid);
  E.mulligan(s, 0, out);
  assert.equal(s.players[0].hand.length, 5);
  assert.equal(s.players[0].deck.length, 25);
  assert.equal(s.players[0].hand.filter(c => out.includes(c.uid)).length, 0);
});

test('the match starts after both mulligans: first player draws and has 1 Sabedoria', () => {
  const s = started(3);
  assert.equal(s.phase, 'main');
  assert.equal(s.round, 1);
  assert.equal(s.turn, 0);
  assert.equal(s.players[0].hand.length, 6);
  assert.equal(s.players[0].deck.length, 24);
  assert.equal(s.players[0].sab, 1);
  assert.equal(s.players[1].hand.length, 5);
});

test('a round is one turn of each player, then the round number advances', () => {
  const s = started();
  E.act(s, { type: 'end' });
  assert.deepEqual([s.round, s.turn], [1, 1]);
  E.act(s, { type: 'end' });
  assert.deepEqual([s.round, s.turn], [2, 0]);
});

test('Sabedoria refills to the round number and unspent Sabedoria is not carried over', () => {
  const s = started();
  endRound(s);
  assert.equal(s.players[0].sab, 2);
  endRound(s);
  assert.equal(s.players[0].sab, 3);
});

test('Sabedoria is capped at 10', () => {
  const s = started();
  s.round = 14;
  endRound(s);
  assert.equal(s.players[0].sab, 10);
});

test('a card drawn into a full hand of 10 goes to the Retiro', () => {
  const s = started();
  const p1 = s.players[1];
  while (p1.hand.length < 10) E.toHand(s, 1, 'capela');
  const deckBefore = p1.deck.length;
  E.act(s, { type: 'end' });
  assert.equal(p1.hand.length, 10);
  assert.equal(p1.deck.length, deckBefore - 1);
  assert.equal(p1.retiro.length, 1);
});

test('an empty deck just skips the draw', () => {
  const s = started();
  s.players[1].deck = [];
  E.act(s, { type: 'end' });
  assert.equal(s.players[1].hand.length, 5);
  assert.equal(s.turn, 1);
});

test('a card that costs more than the available Sabedoria cannot be played', () => {
  const s = fresh();
  s.players[0].sab = 1;
  const uid = give(s, 0, 'capela');
  assert.deepEqual(E.legalPlays(s, 0, uid), []);
  assert.throws(() => play(s, uid, { p: 0, slot: 0 }));
  assert.equal(s.board[0][0], null);
});

test('playing a card pays its cost and moves it from the hand to the board', () => {
  const s = fresh();
  s.players[0].sab = 3;
  const uid = give(s, 0, 'capela');
  const events = play(s, uid, { p: 0, slot: 4 });
  assert.equal(s.players[0].sab, 1);
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.board[0][4].id, 'capela');
  assert.deepEqual(events.find(e => e.t === 'play'), { t: 'play', p: 0, slot: 4, id: 'capela', uid, chain: 1 });
});

test('the player who is not on turn cannot play', () => {
  const s = fresh();
  const uid = give(s, 1, 'capela');
  assert.throws(() => play(s, uid, { p: 1, slot: 0 }));
});
