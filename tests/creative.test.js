import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYERS, blankPools } from '../src/data.js';
import { generateDraw } from '../src/roulette.js';
import { generateCreativeComp, ROLE_ROSTER } from '../src/creative.js';

const PLAYERS = [
  ...DEFAULT_PLAYERS,
  { id: 'foo', name: 'Foo', pools: blankPools() },
  { id: 'bar', name: 'Bar', pools: blankPools() },
];

let seed = 1337;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / (2 ** 32);
}

for (const n of [2, 3, 4, 5]) {
  for (const tone of ['faithful', 'balanced', 'offmeta']) {
    test(`${n} persone / ${tone}: primary, pool donors, comp senza doppi`, () => {
      for (let i = 0; i < 12; i++) {
        const players = PLAYERS.slice(0, n);
        const draw = generateDraw(players, random);
        const comp = generateCreativeComp(draw, players, tone, random);
        assert.equal(comp.picks.length, n);
        assert.equal(new Set(comp.picks.map((p) => p.id)).size, n);
        assert.equal(new Set(comp.picks.map((p) => p.primary)).size, n);
        for (const pick of comp.picks) {
          assert.notEqual(pick.playerId, pick.donorId);
          const donor = players.find((p) => p.id === pick.donorId);
          assert.ok(donor);
          assert.equal(pick.isPool, donor.pools[pick.primary].includes(pick.id));
          assert.ok(pick.isPool || ROLE_ROSTER[pick.primary].some((r) => r.id === pick.id));
          assert.ok(pick.reason);
          if (pick.secondaryChoice) assert.notEqual(pick.secondaryChoice.id, pick.id);
        }
      }
    });
  }
}

test('crea una comp anche quando tutte le pool sono vuote', () => {
  const players = PLAYERS.slice(3, 5);
  const draw = generateDraw(players, random);
  const comp = generateCreativeComp(draw, players, 'balanced', random);
  assert.equal(comp.picks.length, 2);
  assert.ok(comp.picks.every((p) => !p.isPool));
  assert.equal(comp.partial, true);
});

test('rifiuta dati invalidi per la generazione creativa', () => {
  assert.throws(() => generateCreativeComp([], [], 'balanced', random));
  assert.throws(() => generateCreativeComp([{ playerId: 'calo', donorId: 'calo', primary: 'MID' }], PLAYERS, 'balanced', random));
  const draw = generateDraw(PLAYERS.slice(0, 2), random);
  assert.throws(() => generateCreativeComp(draw, PLAYERS, 'unrecognized', random));
});

