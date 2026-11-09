import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_EMPTY_MS, ROOM_IDLE_MS, roomCleanupReason } from '../src/roomCleanupPolicy.js';
import { readFileSync } from 'node:fs';
const now = 1_800_000_000_000;
const base = (overrides = {}) => ({
  meta: { phase: 'waiting', createdAt: now - 50 * 60_000 },
  lastActivityAt: now - 10 * 60_000,
  lastPresenceAt: now - 2 * 60_000,
  members: { a: { online: true, readyRound: 1 } },
  ...overrides,
});
test('Una stanza occupata non scade prima di 30 minuti di inattività', () => {
  assert.equal(roomCleanupReason(base({ lastActivityAt: now - ROOM_IDLE_MS + 1 }), now), null);
  assert.equal(roomCleanupReason(base({ lastActivityAt: now - ROOM_IDLE_MS }), now), 'inactive');
});
test('Vuota: inizia il conto dall’ultima uscita, non dall’ultima attività', () => {
  assert.equal(roomCleanupReason(base({members: {},lastPresenceAt: now - ROOM_EMPTY_MS + 1}), now), null);
  assert.equal(roomCleanupReason(base({members: {},lastPresenceAt: now - ROOM_EMPTY_MS}), now), 'empty');
});
test('Una stanza riaperta non viene eliminata per il vecchio lastPresenceAt', () => {
  assert.equal(roomCleanupReason(base({lastPresenceAt: now - ROOM_EMPTY_MS * 20}), now), null);
  assert.equal(roomCleanupReason(base({members: {}, lastActivityAt: now - 60_000, lastPresenceAt: now - 20 * 60_000}), now), null);
});
test('Legacy senza timestamp: usa lastActivityAt o createdAt', () => {
  assert.equal(roomCleanupReason(base({members: {},lastPresenceAt: undefined,lastActivityAt: now - ROOM_EMPTY_MS}),now), 'empty');
  assert.equal(roomCleanupReason(base({members: {},lastPresenceAt: undefined,lastActivityAt: undefined,meta:{phase:'waiting',createdAt:now-ROOM_EMPTY_MS}}),now),'empty');
});
test('Stanze chiuse ed invalide sono eliminate; stanza attiva rimane', () => {
  assert.equal(roomCleanupReason(base({meta: {phase: 'closed',createdAt:now}}),now), 'closed');
  assert.equal(roomCleanupReason(null,now),'invalid');
  assert.equal(roomCleanupReason(base({lastActivityAt: now - 1}),now),null);
});
test('Le nuove regole consentono i timestamp solo a partecipanti autenticati e non espongono i profili', () => {
  const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  assert.match(rules.rooms.$room.lastPresenceAt['.write'], /members/);
  assert.match(rules.rooms.$room.lastActivityAt['.write'], /auth != null/);
  assert.match(rules.privateProfiles.$uid['.read'], /auth.uid === \$uid/);
});
