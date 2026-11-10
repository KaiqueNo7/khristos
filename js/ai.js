import { legalActions, act, projected, zoneFraq, fraqOf, costOf, fervorReady, slotCount, card } from './engine.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const depth = (s, p) => s.board[p].reduce((n, c) => n + (c ? c.under.length : 0), 0);

function exposure(s, p) {
  let total = 0;
  for (let slot = 0; slot < slotCount(); slot++) {
    const c = s.board[p][slot];
    if (!c || card(c.id).type !== 'Unidade') continue;
    const f = fraqOf(s, p, slot);
    total += (f >= 6 ? 0.3 : 0) + (f >= 8 ? 0.3 : 0);
  }
  return total;
}

function evaluate(s, me) {
  const opp = 1 - me;
  if (s.phase === 'over') return s.winner === null ? 0 : s.winner === me ? 1e6 : -1e6;
  const now = projected(s);
  let value = now.gain[me] * 3 - now.gain[opp] * 2;
  value += (now.held[me] - now.held[opp]) * 4;
  for (const z of now.zones) value += clamp(z.fe[me] - z.fe[opp], -6, 6) * 0.8;
  value += s.players[me].fe - s.players[opp].fe;
  value += (s.players[me].hand.length - s.players[opp].hand.length) * 0.5;
  for (const z of [0, 1, 2]) value += (zoneFraq(s, opp, z) - zoneFraq(s, me, z)) * 0.12;
  value += exposure(s, opp) - exposure(s, me);
  value += depth(s, me) - depth(s, opp);
  return value;
}

const strip = ({ type, uid, slot, at }) => {
  const a = { type };
  if (uid !== undefined) a.uid = uid;
  if (slot !== undefined) a.slot = slot;
  if (at !== undefined) a.at = at;
  return a;
};

export function chooseAction(s, noise = () => 0) {
  const me = s.turn;
  const pl = s.players[me];
  const idOf = a => pl.hand.find(c => c.uid === a.uid).id;
  const floor = evaluate(s, me) + 0.2;
  const seen = new Set();
  const ranked = [];
  for (const a of legalActions(s)) {
    if (a.type === 'end') continue;
    const key = JSON.stringify([a.type, a.type === 'play' ? idOf(a) : a.slot, a.at]);
    if (seen.has(key)) continue;
    seen.add(key);
    const sim = structuredClone(s);
    act(sim, strip(a));
    const score = evaluate(sim, me) + noise();
    if (score > floor) ranked.push({ action: a, score });
  }
  if (!ranked.length) return { type: 'end' };
  ranked.sort((x, y) => y.score - x.score);
  const best = ranked[0].action;
  if (best.type === 'play' && card(idOf(best)).fervor && !fervorReady(s, me)) {
    const budget = pl.sab - costOf(s, me, idOf(best));
    const opener = ranked.find(x => x.action.type === 'play' && !card(idOf(x.action)).fervor && costOf(s, me, idOf(x.action)) <= budget);
    if (opener) return strip(opener.action);
  }
  return strip(best);
}

export function chooseMulligan(s, p) {
  return s.players[p].hand.filter(c => card(c.id).evolvesFrom || card(c.id).sacramento || card(c.id).cost >= 4).map(c => c.uid);
}
