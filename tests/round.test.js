import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, started, give, put, play, endRound } from './helpers.js';

const fe = s => s.players.map(p => p.fe);
const end = s => E.act(s, { type: 'end' });
const resolveOf = events => events.find(e => e.t === 'resolve');

test('without the majority of the zones the Fé does not count', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  const events = end(s);
  assert.deepEqual(fe(s), [0, 0]);
  assert.deepEqual(resolveOf(events), {
    t: 'resolve',
    p: 0,
    round: 1,
    zones: [{ z: 0, fe: [7, 0], dom: 0, gain: 0 }, { z: 1, fe: [0, 0], dom: null, gain: 0 }, { z: 2, fe: [0, 0], dom: null, gain: 0 }],
    held: 1,
    majority: false,
    gain: 0,
    bonus: 0,
    fe: [0, 0]
  });
});

test('with 2 zones dominated, the player who ends the turn gains the Fé difference of each one', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 4, 'capela');
  put(s, 1, 0, 'capela');
  put(s, 1, 8, 'igreja');
  const events = end(s);
  assert.deepEqual(fe(s), [7, 0]);
  const resolve = resolveOf(events);
  assert.deepEqual(resolve.zones, [{ z: 0, fe: [7, 2], dom: 0, gain: 5 }, { z: 1, fe: [2, 0], dom: 0, gain: 2 }, { z: 2, fe: [0, 4], dom: 1, gain: 0 }]);
  assert.deepEqual([resolve.held, resolve.majority, resolve.gain, resolve.bonus, resolve.fe], [2, true, 7, 0, [7, 0]]);
});

test('each player counts at the end of their own turn', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 1, 4, 'igreja');
  put(s, 1, 8, 'igreja');
  end(s);
  assert.deepEqual(fe(s), [0, 0]);
  const events = end(s);
  assert.deepEqual(fe(s), [0, 8]);
  assert.deepEqual([resolveOf(events).p, resolveOf(events).gain], [1, 8]);
});

test('Hegemonia adds 6 Fé for dominating the 3 zones', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 0, 4, 'capela');
  put(s, 0, 8, 'capela');
  const events = end(s);
  assert.deepEqual(fe(s), [12, 0]);
  assert.deepEqual([resolveOf(events).held, resolveOf(events).bonus], [3, 6]);
});

test('a tied lateral zone belongs to whoever dominates the Zona Central', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  put(s, 1, 0, 'capela');
  assert.equal(E.dominator(s, 0), null);
  put(s, 0, 4, 'igreja');
  assert.equal(E.dominator(s, 0), 0);
  end(s);
  assert.deepEqual(fe(s), [4, 0]);
});

test('an empty zone and a tied Zona Central belong to nobody', () => {
  const s = fresh();
  put(s, 0, 4, 'capela');
  put(s, 1, 4, 'capela');
  put(s, 0, 8, 'capela');
  put(s, 1, 8, 'capela');
  assert.deepEqual([0, 1, 2].map(z => E.dominator(s, z)), [null, null, null]);
});

test('the projection says what each player would gain in a Contagem right now', () => {
  const s = fresh();
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 4, 'capela');
  put(s, 1, 0, 'capela');
  put(s, 1, 8, 'igreja');
  assert.deepEqual(E.projected(s), {
    zones: [{ z: 0, fe: [7, 2], dom: 0, gain: [5, 0] }, { z: 1, fe: [2, 0], dom: 0, gain: [2, 0] }, { z: 2, fe: [0, 4], dom: 1, gain: [0, 4] }],
    held: [2, 1],
    gain: [7, 0],
    bonus: [0, 0],
    majority: 0
  });
  end(s);
  assert.deepEqual(fe(s), [7, 0]);
});

test('the domination taken by Joana counts for her majority and gives no Fé from a zone she is losing', () => {
  const s = fresh();
  put(s, 0, 0, 'jo_santo');
  put(s, 0, 4, 'capela');
  put(s, 1, 0, 'catedral');
  E.act(s, { type: 'active', slot: 0 });
  end(s);
  assert.deepEqual(fe(s), [2, 0]);
  end(s);
  assert.deepEqual(fe(s), [2, 0]);
});

test('taking the majority is reported once, at the end of the action that caused it', () => {
  const s = fresh();
  put(s, 0, 0, 'capela');
  const events = play(s, give(s, 0, 'capela'), { p: 0, slot: 4 });
  assert.deepEqual(events[events.length - 1], { t: 'majority', holder: 0, was: null });
  assert.equal(play(s, give(s, 0, 'capela'), { p: 0, slot: 5 }).some(e => e.t === 'majority'), false);
});

test('the second player of the round has 1 more Sabedoria during the first 5 rounds', () => {
  const s = started();
  end(s);
  assert.equal(s.players[1].sab, 2);
  end(s);
  assert.equal(s.players[0].sab, 2);
  end(s);
  assert.equal(s.players[1].sab, 3);
  s.round = 5;
  end(s);
  end(s);
  assert.deepEqual([s.round, s.players[1].sab], [6, 6]);
});

test('the Fé goal is checked at the end of the round, after both players counted', () => {
  const s = fresh();
  s.rules.feToWin = 5;
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 4, 'capela');
  end(s);
  assert.deepEqual([fe(s), s.phase], [[9, 0], 'main']);
  const events = end(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
  assert.deepEqual(events[events.length - 1], { t: 'win', p: 0 });
  assert.deepEqual(E.legalActions(s), []);
  assert.throws(() => end(s));
});

test('when both players are over the goal at the end of the round, the one with more Fé wins', () => {
  const s = fresh();
  s.rules.feToWin = 3;
  s.players[1].fe = 4;
  put(s, 0, 0, 'mosteiro_beneditino');
  put(s, 0, 4, 'capela');
  endRound(s);
  assert.deepEqual([fe(s), s.winner], [[9, 4], 0]);
});

test('a tie at the goal keeps the match going', () => {
  const s = fresh();
  s.rules.feToWin = 2;
  s.players[0].fe = 2;
  s.players[1].fe = 2;
  endRound(s);
  assert.equal(s.phase, 'main');
  assert.equal(s.winner, null);
  assert.equal(s.round, 2);
});

test('from the last round on the higher total wins even below the goal', () => {
  const s = fresh();
  s.round = s.rules.lastRound;
  s.players[0].fe = 4;
  s.players[1].fe = 10;
  endRound(s);
  assert.deepEqual([s.phase, s.winner], ['over', 1]);
});

test('equal totals in the last round go to whoever dominates more zones', () => {
  const s = fresh();
  s.round = s.rules.lastRound;
  s.players[0].fe = 5;
  s.players[1].fe = 5;
  put(s, 1, 8, 'capela');
  endRound(s);
  assert.deepEqual([s.phase, s.winner], ['over', 1]);
});

test('a match still tied 3 rounds after the last round ends in a draw', () => {
  const s = fresh();
  s.round = s.rules.lastRound;
  endRound(s);
  assert.deepEqual([s.phase, s.round], ['main', s.rules.lastRound + 1]);
  s.round = s.rules.lastRound + 3;
  const events = endRound(s);
  assert.deepEqual([s.phase, s.winner], ['over', null]);
  assert.deepEqual(events[events.length - 1], { t: 'win', p: null });
});
