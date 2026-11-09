import test from 'node:test';
import assert from 'node:assert/strict';
import { assignSecondaries, generateDraw, shuffled } from '../src/roulette.js';
import { ROLE_IDS } from '../src/data.js';

const players = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index}` }));

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('shuffle non muta la lista di partenza', () => {
  const original = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffled(original, seeded(42)).sort(), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
});

for (const count of [2, 3, 4, 5]) {
  test(`${count} partecipanti: tutti hanno due ruoli diversi e set di altri`, () => {
    for (let seed = 0; seed < 250; seed += 1) {
      const output = generateDraw(players(count), seeded(seed));
      assert.equal(output.length, count);
      assert.equal(new Set(output.map((r) => r.playerId)).size, count);
      assert.equal(new Set(output.map((r) => r.donorId)).size, count);
      assert.equal(new Set(output.map((r) => r.primary)).size, count);
      assert.equal(new Set(output.map((r) => r.secondary)).size, count);
      // TOP/SUPPORT e SUPPORT/TOP contano come la medesima coppia.
      const unorderedPairs = output.map((r) => [r.primary, r.secondary].sort().join(':'));
      assert.equal(new Set(unorderedPairs).size, count, `Coppia duplicata con ${count} giocatori e seed ${seed}`);
      for (const row of output) {
        assert.notEqual(row.playerId, row.donorId);
        assert.notEqual(row.primary, row.secondary);
        assert.ok(ROLE_IDS.includes(row.primary));
        assert.ok(ROLE_IDS.includes(row.secondary));
      }
    }
  });
}

test('non permette una lobby con meno di due o più di cinque giocatori', () => {
  assert.throws(() => generateDraw(players(1)), /2 a 5/);
  assert.throws(() => generateDraw(players(6)), /2 a 5/);
  assert.throws(() => generateDraw([{ id: 'A' }, { id: 'A' }]), /diversi/);
});


test('non genera coppie speculari (TOP/SUPPORT e SUPPORT/TOP)', () => {
  const primary = ['TOP', 'SUPPORT', 'MID', 'JUNGLE', 'ADC'];
  for (let seed = 0; seed < 1000; seed += 1) {
    const secondary = assignSecondaries(primary, seeded(seed));
    const pairs = primary.map((role, index) => [role, secondary[index]].sort().join(':'));
    assert.equal(new Set(pairs).size, primary.length);
    assert.equal(new Set(secondary).size, primary.length);
  }
});

test('funziona anche con generatore casuale costante (backtracking)', () => {
  for (const n of [2, 3, 4, 5]) {
    for (const value of [0, 0.5, 0.999]) {
      const result = generateDraw(players(n), () => value);
      const pairs = result.map((r) => [r.primary, r.secondary].sort().join(':'));
      assert.equal(new Set(pairs).size, n);
    }
  }
});
