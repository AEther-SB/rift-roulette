import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Firebase resta sulle API modulari attuali, senza downgrade ad API legacy', () => {
  assert.match(pkg.dependencies.firebase, /^\^13\./);
});

test('La dipendenza transitiva grpc-js usa una versione patchata per gli advisory del 2026', () => {
  // Riferimenti: GHSA-m9gg-hp2v-232j e GHSA-f596-whhp-79r4.
  assert.equal(pkg.overrides['@grpc/grpc-js'], '1.14.6');
});
