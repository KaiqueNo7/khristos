/* ═══════════════════════════════════════
   data.js — Load cards.json, expose globals
   ═══════════════════════════════════════ */

let CARDS = {};
let DECK_DEFS = {};

async function loadData() {
  const res = await fetch('./cards.json');
  const json = await res.json();
  CARDS = json.CARD_DEFS;
  DECK_DEFS = json.DECK_LISTS;
}
