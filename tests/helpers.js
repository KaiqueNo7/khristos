import { readFileSync } from 'node:fs';
import * as E from '../js/engine.js';

E.loadCards(JSON.parse(readFileSync(new URL('../cards.json', import.meta.url), 'utf8')));

export { E };

export function started(seed = 1) {
  const s = E.newGame({ decks: ['aq', 'jo'], seed });
  E.mulligan(s, 0, []);
  E.mulligan(s, 1, []);
  return s;
}

export function fresh({ round = 1, seed = 1 } = {}) {
  const s = started(seed);
  for (const pl of s.players) {
    pl.hand = [];
    pl.deck = [];
    pl.sab = 99;
  }
  s.round = round;
  return s;
}

export function give(s, p, id) {
  return E.toHand(s, p, id).uid;
}

export function put(s, p, slot, id, extra = {}) {
  const c = E.createInstance(s, id);
  c.turn = 0;
  Object.assign(c, extra);
  s.board[p][slot] = c;
  return c;
}

export function play(s, uid, at) {
  return E.act(s, { type: 'play', uid, at });
}

export function endRound(s) {
  const events = [...E.act(s, { type: 'end' })];
  events.push(...E.act(s, { type: 'end' }));
  return events;
}

export const slotsOf = plays => plays.map(x => x.at.slot).sort((a, b) => a - b);
export const ids = list => [...list].sort();
