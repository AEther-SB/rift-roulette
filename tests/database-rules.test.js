import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));

// Structural checks only: a live Firebase deploy/emulator is still needed to verify execution.
test('le regole non richiamano metodi inesistenti (numChildren)', () => {
  assert.doesNotMatch(JSON.stringify(rules), /numChildren\s*\(/);
});

test('profili cloud leggibili e modificabili solo dal proprio UID', () => {
  const profile = rules.rules.privateProfiles.$uid;
  assert.match(profile['.read'], /auth\.uid === \$uid/);
  assert.match(profile['.write'], /auth\.uid === \$uid/);
});

test('i membri possono aggiornare solo il proprio record', () => {
  const member = rules.rules.rooms.$room.members.$uid;
  assert.match(member['.write'], /auth\.uid === \$uid/);
  assert.equal(member.$other['.validate'], false);
});

test('pools limitate a chiavi di ruolo/indice e consigli limitati a tre campi', () => {
  const member = rules.rules.rooms.$room.members.$uid;
  assert.match(member.pools.$role.$index['.validate'], /\$index\.matches/);
  assert.equal(member.advice.$role.$champion.$other['.validate'], false);
});
