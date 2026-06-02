/* ═══════════════════════════════════════
   state.js — GameState singleton + mutations
   ═══════════════════════════════════════ */

let G = null;
let _idc = 0;

function genId() { return 'i' + (_idc++); }

function buildEmptySlots() {
  const sizes = [4, 2, 4];
  return sizes.map(sz => [
    Array.from({ length: sz }, () => ({ card: null })),
    Array.from({ length: sz }, () => ({ card: null }))
  ]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(deckId) {
  return DECK_DEFS[deckId].map(defId => ({ instanceId: genId(), defId }));
}

function drawCard(player) {
  if (player.deck.length === 0) return null;
  const c = player.deck.pop();
  player.hand.push(c);
  return c;
}

function addFe(player, amount) {
  player.fe = Math.max(0, player.fe + amount);
}

function makeBoardCard(handCard) {
  const def = CARDS[handCard.defId];
  return {
    instanceId: handCard.instanceId,
    defId: handCard.defId,
    fe: def.fe,
    fraq: def.fraq,
    equippedRelics: [],
    silenced: 0,
    immuneFragTurns: 0,
    tempFeBuff: 0,
    estandarteTurns: 0,
    freiMoveCount: 0,
  };
}

function newGame(playerDeckId) {
  _idc = 0;
  const enemyDeckId = playerDeckId === 'aq' ? 'jo' : 'aq';
  G = {
    turn: 1,
    phase: 'mulligan', // mulligan | my | enemy | resolving
    playerDeckId,
    enemyDeckId,
    me: {
      fe: 0, sab: 1,
      deck: shuffle(buildDeck(playerDeckId)),
      hand: [], discard: [],
      forcedDomination: [false, false, false],
      simoniaNextTurn: false,
      usedActives: new Set(),
    },
    enemy: {
      fe: 0, sab: 1,
      deck: shuffle(buildDeck(enemyDeckId)),
      hand: [], discard: [],
      forcedDomination: [false, false, false],
      simoniaNextTurn: false,
      usedActives: new Set(),
    },
    slots: buildEmptySlots(),
    selectedHandCard: null,
    selectedBoardCard: null,
    mulliganSelection: new Set(),
    log: [],
  };
  for (let i = 0; i < 5; i++) { drawCard(G.me); drawCard(G.enemy); }
}

function deckLabel(id) {
  return id === 'aq' ? 'São Tomás de Aquino' : "Joana D'Arc";
}

function getOwnerIdx(player) { return player === G.me ? 0 : 1; }
function getPlayer(idx) { return idx === 0 ? G.me : G.enemy; }
function getOpponent(idx) { return idx === 0 ? G.enemy : G.me; }

function getAllCardsForOwner(ownerIdx) {
  const out = [];
  for (let z = 0; z < 3; z++)
    for (const s of G.slots[z][ownerIdx])
      if (s.card) out.push({ card: s.card, zone: z });
  return out;
}

function getFreeSlot(zoneIdx, ownerIdx) {
  return G.slots[zoneIdx][ownerIdx].findIndex(s => s.card === null);
}

function findCardLocation(instanceId) {
  for (let z = 0; z < 3; z++)
    for (let o = 0; o < 2; o++)
      for (let s = 0; s < G.slots[z][o].length; s++)
        if (G.slots[z][o][s].card && G.slots[z][o][s].card.instanceId === instanceId)
          return { zone: z, owner: o, slot: s };
  return null;
}

function removeCardFromBoard(instanceId) {
  const loc = findCardLocation(instanceId);
  if (!loc) return null;
  const card = G.slots[loc.zone][loc.owner][loc.slot].card;
  G.slots[loc.zone][loc.owner][loc.slot].card = null;
  return { card, loc };
}
