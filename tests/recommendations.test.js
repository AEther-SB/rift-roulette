import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYERS, ROLE_IDS, blankPools } from '../src/data.js';
import { generateDraw } from '../src/roulette.js';
import { generateRoleSelections, generateRecommendedComps, sampleChampions, validateLobbyPools } from '../src/recommendations.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 2 ** 32; };
}
const extra = (id) => ({ id, name: id, pools: structuredClone(DEFAULT_PLAYERS[0].pools) });
const players = [...DEFAULT_PLAYERS, extra('four'), extra('five')];

test('una pool lunga estrae esattamente 3 champion unici, senza modificare l’originale', () => {
  const pool = ['Aatrox', 'Sett', 'Garen', 'Teemo', 'Darius', 'Fiora', 'Shen', 'Mordekaiser'];
  const chosen = sampleChampions(pool, 3, seeded(42));
  assert.equal(chosen.length, 3);
  assert.equal(new Set(chosen).size, 3);
  assert.ok(chosen.every((id) => pool.includes(id)));
  assert.equal(pool.length, 8);
});

test('1 o 2 champion vengono estratti tutti, con uno principale', () => {
  assert.deepEqual(sampleChampions(['Lux'], 3, seeded(1)), ['Lux']);
  const chosen = sampleChampions(['Lux', 'Ahri'], 3, seeded(5));
  assert.equal(chosen.length, 2);
  assert.equal(new Set(chosen).size, 2);
});

test('la pescata è veramente variabile cambiando il seed', () => {
  const pool = Array.from({ length: 15 }, (_, i) => `Champion${i}`);
  const outputs = Array.from({ length: 25 }, (_, i) => sampleChampions(pool, 3, seeded(i)).join(':'));
  assert.ok(new Set(outputs).size > 8);
});

for (const n of [2, 3, 4, 5]) {
  for (const mode of ['classic', 'creative']) {
    test(`${n} giocatori / ${mode}: pool estratte e team comp coerenti`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const random = seeded(seed);
        const party = players.slice(0, n);
        const draw = generateDraw(party, random);
        const selections = generateRoleSelections(draw, party, random);
        const comps = generateRecommendedComps(draw, party, selections, mode, 'balanced', random);
        assert.ok(comps.length >= 1 && comps.length <= 3);
        assert.equal(new Set(comps.map((c) => c.picks.map((p) => p.id).join(':'))).size, comps.length);
        for (const entry of draw) {
          const donor = party.find((p) => p.id === entry.donorId);
          for (const [key, role] of [['primary', entry.primary], ['secondary', entry.secondary]]) {
            const values = selections[entry.playerId][key];
            assert.ok(values.length >= 1 && values.length <= 3);
            assert.equal(new Set(values).size, values.length);
            assert.ok(values.every((id) => donor.pools[role].includes(id)));
          }
        }
        for (const comp of comps) {
          assert.equal(comp.picks.length, n);
          assert.equal(new Set(comp.picks.map((p) => p.id)).size, n);
          assert.ok(comp.style.label);
          for (const pick of comp.picks) {
            const donor = party.find((p) => p.id === pick.donorId);
            assert.equal(pick.isPool, donor.pools[pick.primary].includes(pick.id));
            if (mode === 'classic') {
              assert.equal(pick.isPool, true);
              assert.ok(selections[pick.playerId].primary.includes(pick.id));
            }
          }
        }
      }
    });
  }
}

test('nessun ruolo può essere vuoto per un giocatore della lobby', () => {
  const incomplete = { id: 'new', name: 'New', pools: blankPools() };
  assert.throws(() => validateLobbyPools([incomplete]), /almeno 1 campione/);
});

test('se le pool classiche producono champion identici, resta il roll senza comp impossibile', () => {
  const narrow = ['a', 'b'].map((id) => ({ id, name: id, pools: Object.fromEntries(ROLE_IDS.map((role) => [role, ['Lux']])) }));
  const random = seeded(4);
  const draw = generateDraw(narrow, random);
  const selections = generateRoleSelections(draw, narrow, random);
  assert.deepEqual(generateRecommendedComps(draw, narrow, selections, 'classic', 'balanced', random), []);
  assert.ok(generateRecommendedComps(draw, narrow, selections, 'creative', 'offmeta', random).length);
});

test('le modalità non supportate vengono rifiutate', () => {
  const random = seeded(123);
  const draw = generateDraw(players.slice(0, 2), random);
  const selections = generateRoleSelections(draw, players, random);
  assert.throws(() => generateRecommendedComps(draw, players, selections, 'wrong', 'balanced', random), /Modalità/);
  assert.throws(() => generateRecommendedComps(draw, players, selections, 'classic', 'wrong', random), /Stile/);
});
