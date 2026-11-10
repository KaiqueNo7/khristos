# Khristós - Agent Context

Bird's-eye view of the game for AI agents working on this project. Full rules: `GDD.md`.

## Core Loop
1. **Resource:** Sabedoria equals the round number (max 10), refills every turn, never carries over. The second player of the round has 1 more during the first 5 rounds (`RULES.secondSab`).
2. **Action:** play Units, Monuments, Saints, Relics, Blessings and Heresies; use card actives.
3. **Evolution:** a higher card only enters on top of its predecessor (Pokémon style), one step per turn, paying the cost difference.
4. **Contagem:** when a player ends their turn, if they dominate at least 2 of the 3 zones they gain the Faith difference of each zone they dominate (+6 with all three, Hegemonia). Without the majority they gain nothing.
5. **Win condition:** 100 Global Faith, checked at the end of the round (`RULES.feToWin`). From `RULES.lastRound` on the higher total wins.

## Board
- 24 slots, 12 per player. Each zone is a 2 x 2 grid per player: row 0 is the frente (next to the opponent), row 1 the fundo. Zona 1 = slots 0-3, Zona Central = 4-7, Zona 3 = 8-11; inside a zone `local = row * cols + col`. `RULES.zoneCols` drives the geometry.
- Adjacency is orthogonal inside the zone grid, never diagonal, never across zones.
- Zona Central is the "coringa": a tied lateral zone belongs to whoever dominates the Central, and a Santo standing in it reaches the three zones.
- Cards never leave the board, except through Inquisição, Profanação do Altar or the owner replacing a card in a full zone. Removed cards go to the Retiro.

## Combos
- **Sacramentos** (`sacramento: { minister, place? }`): Blessings that need a clergy card of that rank or higher, other than the target, and a temple of that rank or higher, anywhere on the caster's side.
- **Fervor** (`fervor: true`): bonus when the card is not the first one played this turn (`players[p].played`).
- **Fraqueza:** Heresies gate on it (6 = can be chosen, 8 = exposed), scale with it, or raise it; some Blessings turn the caster's own Fraqueza into Faith.

## Card Data (`cards.json`)
- `fe`, `fraq`, `cost`: printed Faith, Weakness and Sabedoria cost.
- `slots`: how many relics the card can hold. Every card takes exactly one board slot.
- `evolvesTo` / `evolveReq`: evolution line and the zone requirement to enter.
- `vocacao`: on entering, fetch the next card of the line from the deck.
- `target` and `req`: targeting and requirements of Blessings and Heresies.
- `effect`: the card text. It must say exactly what `js/engine.js` does.

## Key Files
- `js/engine.js`: pure rules engine. State is plain JSON, safe for `structuredClone`. `act(state, action)` mutates the state and returns the events the UI animates.
- `js/ai.js`: one-step lookahead over `legalActions`, plus one ordering rule for Fervor.
- `js/ui.js`: rendering, drag and drop, and one animation handler per engine event.
- `js/audio.js`: synthesised sound (organ, choir, timpani, bells) and the generative underscore. `createSound(ctx)` works on an `OfflineAudioContext`.
- `js/fx.js`: canvas particles.
- `tests/`: `node --test`. Every rule and every card effect has a test.
- `tools/sim.js`: AI against AI, for pacing and balance. `tools/audio-check.html` renders every sound offline and measures it.

## Durations
- "até o fim do seu turno": Joana's forced domination.
- "até o seu próximo turno": temporary Faith, São Tomás's doctrine, Cisma, Manto. They cover the caster's Contagem and the opponent's.
- "por N rodadas": `silenced`, `noFe`, `drain` tick at the end of the card owner's turn, after that owner's Contagem.

## Commands
- `npm start`: static server on port 5180.
- `npm test`: engine and AI tests.
- `npm run sim`: balance simulation. `node tools/sim.js 300 feToWin=90` overrides a rule.

## Development Principles
- Rules live in the engine, never in the UI. Write the test first.
- A new card needs: its entry in `cards.json`, its logic in the engine keyed by id, and a test.
- Passives are split in two: Fraqueza passives may read base Faith values, Faith passives may read final Fraqueza. Keep it that way or the two will recurse.
- Run `npm run sim` after changing numbers; keep the median match near 11 rounds, both decks between 42% and 58% and the first seat between 44% and 56%.
- No combat and no attacking: influence only.
- Visuals stay solemn: altarpiece board, halo as score, candles as Sabedoria.
