import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E, fresh, give, put, play } from './helpers.js';

const stats = (s, p, slot) => [E.feOf(s, p, slot), E.fraqOf(s, p, slot)];

const cases = [
  ['Seminarista alone keeps its printed 2 Fé and 8 Fraqueza', s => put(s, 0, 0, 'seminarista'), [0, 0], [2, 8]],
  ['Seminarista beside a Monumento gains 1 Fé', s => { put(s, 0, 0, 'seminarista'); put(s, 0, 1, 'capela'); }, [0, 0], [3, 8]],
  ['Seminarista beside a Santo gains 1 Fé', s => { put(s, 0, 0, 'seminarista'); put(s, 0, 1, 'sta_santo'); }, [0, 0], [3, 8]],
  ['adjacency does not cross from one zone to the next', s => { put(s, 0, 3, 'seminarista'); put(s, 0, 4, 'capela'); put(s, 0, 6, 'capela'); }, [0, 3], [2, 8]],
  ['Padre away from Monumentos keeps 6 Fraqueza', s => put(s, 0, 0, 'padre'), [0, 0], [4, 6]],
  ['Padre beside a Monumento loses 3 Fraqueza', s => { put(s, 0, 0, 'padre'); put(s, 0, 1, 'capela'); }, [0, 0], [4, 3]],
  ['Eremita alone in the zone gains 3 Fé and loses 5 Fraqueza', s => put(s, 0, 8, 'eremita'), [0, 8], [7, 1]],
  ['Eremita with another unit in the zone gets nothing', s => { put(s, 0, 8, 'eremita'); put(s, 0, 9, 'acolito'); }, [0, 8], [4, 6]],
  ['a Monumento does not break the solitude of the Eremita', s => { put(s, 0, 8, 'eremita'); put(s, 0, 9, 'capela'); }, [0, 8], [7, 1]],
  ['Devoto alone keeps its printed values', s => put(s, 0, 0, 'devoto'), [0, 0], [2, 8]],
  ['Devoto beside a Santo gains 1 Fé and loses 3 Fraqueza', s => { put(s, 0, 0, 'devoto'); put(s, 0, 1, 'jo_santo'); }, [0, 0], [3, 5]],
  ['Cavaleiro Templário alone has zone Fraqueza 6 and gains 3 Fé', s => put(s, 0, 0, 'cavaleiro_templario'), [0, 0], [5, 6]],
  ['Cavaleiro Templário in a zone with 14 Fraqueza gets nothing', s => { put(s, 0, 0, 'cavaleiro_templario'); put(s, 0, 3, 'devoto'); }, [0, 0], [2, 6]],
  ['an Igreja lowers the zone Fraqueza the Cavaleiro Templário looks at', s => { put(s, 0, 0, 'cavaleiro_templario'); put(s, 0, 3, 'igreja'); }, [0, 0], [5, 6]],
  ['Jovem de Fé alone keeps its printed values', s => put(s, 0, 0, 'jovem_de_fe'), [0, 0], [4, 7]],
  ['Jovem de Fé with Joana in the zone gains 2 Fé and loses 2 Fraqueza', s => { put(s, 0, 0, 'jovem_de_fe'); put(s, 0, 3, 'jo_santo'); }, [0, 0], [6, 5]],
  ['Jovem de Fé in a zone with 10 Fé gains 2 Fé and loses 2 Fraqueza', s => { put(s, 0, 0, 'jovem_de_fe'); put(s, 0, 2, 'capela'); put(s, 0, 3, 'igreja'); }, [0, 0], [6, 5]],
  ['Jovem de Fé in a zone with 6 Fé gets nothing', s => { put(s, 0, 0, 'jovem_de_fe'); put(s, 0, 3, 'capela'); }, [0, 0], [4, 7]],
  ['Basílica gives 1 Fé to allied units in the zone', s => { put(s, 0, 0, 'basilica'); put(s, 0, 3, 'acolito'); }, [0, 3], [2, 9]],
  ['Basílica gives nothing to Monumentos', s => { put(s, 0, 0, 'basilica'); put(s, 0, 3, 'capela'); }, [0, 3], [2, 0]],
  ['Basílica gives nothing to enemy units', s => { put(s, 0, 0, 'basilica'); put(s, 1, 2, 'acolito'); }, [1, 2], [1, 9]],
  ['Catedral gives 2 Fé to allied units in the zone', s => { put(s, 0, 0, 'catedral'); put(s, 0, 3, 'acolito'); }, [0, 3], [3, 9]],
  ['Mosteiro Beneditino takes 2 Fraqueza from allied units in the zone', s => { put(s, 0, 8, 'mosteiro_beneditino'); put(s, 0, 11, 'acolito'); }, [0, 11], [1, 7]],
  ['Bispo gives 1 Fé to an Igreja in the zone', s => { put(s, 0, 0, 'bispo'); put(s, 0, 3, 'igreja'); }, [0, 3], [5, 0]],
  ['Cardeal gives 2 Fé to an adjacent allied unit', s => { put(s, 0, 1, 'cardeal'); put(s, 0, 0, 'acolito'); }, [0, 0], [3, 9]],
  ['Cardeal gives nothing to a unit that is not adjacent', s => { put(s, 0, 1, 'cardeal'); put(s, 0, 2, 'acolito'); }, [0, 2], [1, 9]],
  ['Cardeal gives 2 Fé to Monumentos in the zone', s => { put(s, 0, 1, 'cardeal'); put(s, 0, 2, 'capela'); }, [0, 2], [4, 0]],
  ['Joana gives 2 Fraqueza to enemy units in her zone', s => { put(s, 1, 0, 'jo_santo'); put(s, 0, 1, 'acolito'); }, [0, 1], [1, 11]],
  ['Joana does not reach enemy units in other zones', s => { put(s, 1, 0, 'jo_santo'); put(s, 0, 8, 'acolito'); }, [0, 8], [1, 9]],
  ['Joana does not change the Fraqueza of an enemy Santo', s => { put(s, 1, 0, 'jo_santo'); put(s, 0, 2, 'sta_santo'); }, [0, 2], [9, 1]],
  ['a silenced unit loses its own passive', s => { put(s, 0, 0, 'seminarista', { silenced: 1 }); put(s, 0, 1, 'capela'); }, [0, 0], [2, 8]],
  ['a silenced Cardeal gives no aura', s => { put(s, 0, 1, 'cardeal', { silenced: 1 }); put(s, 0, 0, 'acolito'); }, [0, 0], [1, 9]],
  ['an accused unit generates no Fé', s => put(s, 0, 0, 'acolito', { noFe: 2, feMod: 3 }), [0, 0], [0, 9]],
  ['a drained Monumento has 3 less Fé', s => put(s, 0, 0, 'igreja', { drain: 2 }), [0, 0], [1, 0]],
  ['Fé never goes below zero', s => put(s, 0, 0, 'capela', { drain: 1 }), [0, 0], [0, 0]],
  ['temporary Fé adds to the card', s => put(s, 0, 0, 'acolito', { tempFe: 3 }), [0, 0], [4, 9]],
  ['Heresia modifiers change Fé and Fraqueza', s => put(s, 0, 0, 'seminarista', { hFe: -1, hFraq: 3 }), [0, 0], [1, 11]],
  ['the doctrine takes 3 Fraqueza from the units of the taught zone', s => { s.players[0].doctrine = [0]; put(s, 0, 0, 'acolito'); }, [0, 0], [1, 6]],
  ['the doctrine does not reach a zone that was not taught', s => { s.players[0].doctrine = [0]; put(s, 0, 8, 'acolito'); }, [0, 8], [1, 9]],
  ['the doctrine does not apply to Santos', s => { s.players[0].doctrine = [0]; put(s, 0, 0, 'jo_santo'); }, [0, 0], [7, 6]],
  ['Fraqueza never goes below zero', s => { s.players[0].doctrine = [0]; put(s, 0, 0, 'cardeal', { fraqMod: -2 }); }, [0, 0], [8, 0]],
  ['Joana in the Zona Central raises the Fraqueza of enemy units in every zone', s => { put(s, 1, 4, 'jo_santo'); put(s, 0, 8, 'acolito'); }, [0, 8], [1, 11]],
  ['the Armadura keeps Joana away even from the Zona Central', s => { put(s, 1, 4, 'jo_santo'); put(s, 0, 8, 'acolito', { relics: [{ id: 'armadura' }] }); }, [0, 8], [3, 9]],
  ['Jovem de Fé is inspired by Joana in the Zona Central', s => { put(s, 0, 4, 'jo_santo'); put(s, 0, 8, 'jovem_de_fe'); }, [0, 8], [6, 5]],
  ['Jovem de Fé is not inspired by Joana in another lateral zone', s => { put(s, 0, 0, 'jo_santo'); put(s, 0, 8, 'jovem_de_fe'); }, [0, 8], [4, 7]],
  ['a Monumento never has Fraqueza', s => put(s, 0, 0, 'capela', { hFraq: 3 }), [0, 0], [2, 0]]
];

for (const [name, setup, [p, slot], want] of cases) {
  test(name, () => {
    const s = fresh();
    setup(s);
    assert.deepEqual(stats(s, p, slot), want);
  });
}

test('the Mosteiro lowers the zone Fraqueza the Cavaleiro Templário looks at', () => {
  const s = fresh();
  put(s, 0, 0, 'cavaleiro_templario');
  put(s, 0, 3, 'mosteiro_beneditino');
  assert.deepEqual(stats(s, 0, 0), [5, 4]);
});

test('zone Fé is the sum of the final Fé of the cards in it', () => {
  const s = fresh();
  put(s, 0, 0, 'seminarista');
  put(s, 0, 1, 'capela');
  assert.equal(E.zoneFe(s, 0, 0), 5);
  assert.equal(E.zoneFe(s, 0, 2), 0);
});

test('zone Fraqueza is the sum of the cards, and each Igreja takes 2 from the total', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  assert.equal(E.zoneFraq(s, 0, 0), 9);
  put(s, 0, 1, 'igreja');
  assert.equal(E.zoneFraq(s, 0, 0), 7);
  put(s, 0, 3, 'igreja');
  assert.equal(E.zoneFraq(s, 0, 0), 5);
});

test('a Padre climbs the offices of the Presbitério as its zone grows', () => {
  const s = fresh();
  put(s, 1, 0, 'catedral');
  put(s, 1, 1, 'mosteiro_beneditino');
  put(s, 0, 0, 'padre');
  assert.equal(E.officeOf(s, 0, 0).name, 'Vigário Paroquial');
  assert.equal(E.officeOf(s, 0, 0).next.name, 'Pároco');
  assert.deepEqual(stats(s, 0, 0), [4, 6]);
  put(s, 0, 1, 'capela');
  assert.equal(E.officeOf(s, 0, 0).name, 'Pároco');
  assert.deepEqual(stats(s, 0, 0), [4, 3]);
  put(s, 0, 2, 'acolito');
  put(s, 0, 3, 'acolito');
  assert.equal(E.officeOf(s, 0, 0).name, 'Decano');
  assert.deepEqual(stats(s, 0, 0), [5, 3]);
  put(s, 0, 8, 'bispo');
  assert.equal(E.officeOf(s, 0, 0).name, 'Vigário Episcopal');
  assert.deepEqual(stats(s, 0, 0), [6, 3]);
  s.board[1][0] = null;
  s.board[1][1] = null;
  assert.equal(E.officeOf(s, 0, 0).name, 'Vigário Geral');
  assert.equal(E.officeOf(s, 0, 0).next, null);
  assert.deepEqual(stats(s, 0, 0), [7, 3]);
});

test('a Bispo climbs the offices of the Episcopado as its owner dominates zones', () => {
  const s = fresh();
  put(s, 1, 8, 'catedral');
  put(s, 0, 8, 'bispo');
  assert.equal(E.officeOf(s, 0, 8).name, 'Bispo Auxiliar');
  assert.equal(E.feOf(s, 0, 8), 6);
  s.board[1][8] = null;
  assert.equal(E.officeOf(s, 0, 8).name, 'Bispo Diocesano');
  assert.equal(E.feOf(s, 0, 8), 7);
  put(s, 0, 0, 'capela');
  assert.equal(E.officeOf(s, 0, 8).name, 'Arcebispo Metropolitano');
  assert.equal(E.feOf(s, 0, 8), 8);
});

test('cards outside the Presbitério and the Episcopado have no office', () => {
  const s = fresh();
  put(s, 0, 0, 'acolito');
  assert.equal(E.officeOf(s, 0, 0), null);
});

test('a silenced Padre falls back to its first office', () => {
  const s = fresh();
  put(s, 0, 0, 'padre', { silenced: 1 });
  put(s, 0, 1, 'capela');
  assert.equal(E.officeOf(s, 0, 0).name, 'Vigário Paroquial');
});

test('a play that promotes a Padre reports the new office', () => {
  const s = fresh();
  put(s, 0, 0, 'padre');
  const events = play(s, give(s, 0, 'capela'), { p: 0, slot: 1 });
  assert.deepEqual(events.filter(e => e.t === 'office'), [{ t: 'office', p: 0, slot: 0, name: 'Pároco', up: true }]);
});
