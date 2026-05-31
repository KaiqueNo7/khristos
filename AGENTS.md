# Khristós - Agent Context

This file provides a bird's-eye view of the game mechanics and structure for AI agents working on this project.

## Core Loop
1. **Resource:** 1 Wisdom (Sabedoria) gained per turn.
2. **Action:** Play Units, Monuments, Relics, and Miracles.
3. **Evolution:** Cards stay on board; they evolve rather than dying.
4. **Scoring:** Round end calculates local Faith diffs (`Ally Faith - Enemy Faith`) and adds to Global Faith.
5. **Win Condition:** 50 Global Faith OR "Jesus Christ" special win.

## Card Attributes
- **Faith (Fé):** Positive influence.
- **Weakness (Fraqueza):** Vulnerability score.
- **Cost (Sabedoria):** Resource needed to play.

## Board Layout
- **Slots:** 10 total (5 per player).
- **Zonas:** 1, 3 (early) and Central (unlocks Turn 5).
- **Adjacency:** Lateral only.

## Key Files
- `GDD.md`: Full game design document.
- `cards.json`: Card database (Units, Monuments, etc.).
- `khristos.html`: Main game engine/prototype.

## Development Principles
- Focus on territorial control and spiritual influence.
- Visuals should be solemn and renaissance-inspired.
- Avoid traditional combat (no "attacking" health).
