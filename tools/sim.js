import { readFileSync } from 'node:fs';
import * as E from '../js/engine.js';
import { chooseAction, chooseMulligan } from '../js/ai.js';

const json = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const games = Number(args.find(a => /^\d+$/.test(a)) || 400);
for (const a of args) {
  const [key, value] = a.split('=');
  if (value === undefined) continue;
  const path = key.split('.');
  let node = json.RULES;
  while (path.length > 1) node = node[path.shift()];
  node[path[0]] = Number(value);
}
E.loadCards(json);

function noiseFrom(seed) {
  let x = seed | 0;
  return () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5) * 1.5;
  };
}

const sorted = a => [...a].sort((x, y) => x - y);
const median = a => sorted(a)[Math.floor(a.length / 2)];
const pct = (a, q) => sorted(a)[Math.floor(a.length * q)];
const mean = a => a.reduce((n, x) => n + x, 0) / Math.max(1, a.length);
const share = (n, d) => `${Math.round((n / Math.max(1, d)) * 100)}%`;

const wins = { aq: 0, jo: 0 };
const seatWins = [0, 0];
const deckGames = { aq: 0, jo: 0 };
const rounds = [];
const loserShare = [];
const flips = [];
const played = { aq: {}, jo: {} };
const topRung = {};
const perGame = { sacramentos: [], fervor: [], heresias: [] };
const counts = { all: 0, paid: 0, seat: [[0, 0], [0, 0]] };
let draws = 0;
let late = 0;
let biggest = [];

for (let g = 0; g < games; g++) {
  const decks = g % 2 ? ['aq', 'jo'] : ['jo', 'aq'];
  const first = (g >> 1) % 2;
  const s = E.newGame({ decks, seed: g + 1, first });
  const noise = noiseFrom(g * 7919 + 13);
  E.mulligan(s, 0, chooseMulligan(s, 0));
  E.mulligan(s, 1, chooseMulligan(s, 1));
  const seen = [new Set(), new Set()];
  const tally = { sacramentos: 0, fervor: 0, heresias: 0 };
  let changes = 0;
  let top = 0;
  let steps = 0;
  while (s.phase === 'main' && steps++ < 20000) {
    for (const e of E.act(s, chooseAction(s, noise))) {
      if (['play', 'evolve', 'equip', 'spell'].includes(e.t)) {
        seen[e.p].add(e.id);
        if (e.fervor) tally.fervor++;
        if (e.sacramento) tally.sacramentos++;
        if (e.t === 'spell' && E.card(e.id).type === 'Heresia') tally.heresias++;
      }
      if (e.t === 'majority' && e.holder !== null) changes++;
      if (e.t === 'resolve') {
        const seat = e.p === s.first ? 0 : 1;
        counts.all++;
        counts.seat[seat][1]++;
        if (e.gain > 0) {
          counts.paid++;
          counts.seat[seat][0]++;
          top = Math.max(top, e.gain);
        }
      }
    }
  }
  if (s.phase !== 'over') {
    console.log(`partida ${g} não terminou (rodada ${s.round})`);
    continue;
  }
  decks.forEach((deck, p) => {
    deckGames[deck]++;
    for (const id of seen[p]) played[deck][id] = (played[deck][id] || 0) + 1;
  });
  rounds.push(s.round);
  flips.push(changes);
  biggest.push(top);
  for (const key of Object.keys(tally)) perGame[key].push(tally[key]);
  if (s.round >= s.rules.lastRound) late++;
  if (s.winner === null) {
    draws++;
    continue;
  }
  wins[decks[s.winner]]++;
  seatWins[s.winner === s.first ? 0 : 1]++;
  loserShare.push(s.players[1 - s.winner].fe / Math.max(1, s.players[s.winner].fe));
  const aq = decks.indexOf('aq');
  const line = E.lineOf('acolito');
  const rung = Math.max(0, ...s.board[aq].filter(Boolean).map(c => line.indexOf(c.id) + 1));
  topRung[rung] = (topRung[rung] || 0) + 1;
}

const done = rounds.length;
const decided = done - draws;
const rules = json.RULES;
console.log(`partidas: ${done}  meta: ${rules.feToWin}  Hegemonia: ${rules.hegemony}  segunda cadeira: +${rules.secondSab.bonus} até a rodada ${rules.secondSab.untilRound}`);
console.log(`vitórias  São Tomás ${share(wins.aq, decided)}  Joana ${share(wins.jo, decided)}  empates ${draws}`);
console.log(`vitórias  quem começa ${share(seatWins[0], decided)}  quem responde ${share(seatWins[1], decided)}`);
console.log(`rodadas   mediana ${median(rounds)}  p10 ${pct(rounds, 0.1)}  p90 ${pct(rounds, 0.9)}  máx ${Math.max(...rounds)}  chegaram à última rodada ${share(late, done)}`);
console.log(`Fé do perdedor sobre a do vencedor (mediana): ${Math.round(median(loserShare) * 100)}%`);
console.log(`Contagens que deram Fé: ${share(counts.paid, counts.all)}  (quem começa ${share(counts.seat[0][0], counts.seat[0][1])}, quem responde ${share(counts.seat[1][0], counts.seat[1][1])})  maior Contagem (mediana) ${median(biggest)}`);
console.log(`trocas de maioria por partida: mediana ${median(flips)}  p10 ${pct(flips, 0.1)}`);
console.log(`por partida (média): Sacramentos ${mean(perGame.sacramentos).toFixed(1)}  bônus de Fervor ${mean(perGame.fervor).toFixed(1)}  Heresias ${mean(perGame.heresias).toFixed(1)}`);
console.log(`degrau mais alto do clero (São Tomás): ${Object.entries(topRung).map(([k, v]) => `${k}:${share(v, decided)}`).join('  ')}`);
for (const deck of ['aq', 'jo']) {
  const rate = [...new Set(E.deckList(deck))].map(id => [id, (played[deck][id] || 0) / Math.max(1, deckGames[deck])]).sort((a, b) => a[1] - b[1]);
  console.log(`${deck}, cartas jogadas (% das partidas): ${rate.map(([id, r]) => `${id} ${Math.round(r * 100)}`).join(', ')}`);
}
