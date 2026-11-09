import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PLAYERS, blankPools, ROLE_IDS } from '../src/data.js';
import { cleanOwnProfile, cleanRoomCode, isProfileComplete, readyMembers,
  createSharedResult, makeRoomCode, cleanAdvice, adviceForDraw } from '../src/roomLogic.js';

const players = DEFAULT_PLAYERS.map((p) => ({ ...p }));
const memberRoom = (count, ready = true, phase = 'waiting') => ({
  meta: { hostUid: 'x0', phase, round: 2, expectedPlayers: 2 },
  members: Object.fromEntries(players.slice(0, count).map((p, i) => [
    `x${i}`, { ...p, online: true, readyRound: ready ? 2 : 1, joinedAt: i + 1 },
  ])),
});

test('I codici stanza sono 8 caratteri validi, senza I e O', () => {
  const code = makeRoomCode(new Uint8Array([0,1,2,3,4,5,6,7]));
  assert.equal(code, 'ABCDEFGH');
  assert.equal(cleanRoomCode('ab cde-fgh'), 'ABCDEFGH');
  assert.equal(cleanRoomCode('ii oo xx 999'), 'XX999');
});

test('Profilo locale pulito conserva pool lunghe e priorità, senza duplicati', () => {
  const pool = Array.from({length: 195}, (_, i) => `Champ${i}`);
  const input = { name: 'Calo', pools: { ...blankPools(), MID: [...pool, 'Champ0'] } };
  const sanitized = cleanOwnProfile(input);
  assert.deepEqual(sanitized.pools.MID, pool);
  assert.equal(isProfileComplete(sanitized), false);
  assert.equal(sanitized.pools.MID.length, 195);
});

test('Pronto solo se TUTTI i partecipanti hanno le 5 pool e stesso round', () => {
  const room = memberRoom(3);
  assert.equal(readyMembers(room).length, 3);
  room.meta.expectedPlayers = 4; // V6: il campo legacy è ignorato.
  assert.equal(readyMembers(room).length, 3);
  room.meta.expectedPlayers = 3;
  room.members.x1.readyRound = 1;
  assert.equal(readyMembers(room).length, 0);
  room.members.x1.readyRound = 2;
  room.members.x2.online = false;
  assert.equal(readyMembers(room).length, 0);
  room.members.x2.online = true;
  room.members.x0.pools.MID = [];
  assert.equal(readyMembers(room).length, 0);
  room.members.x0.pools.MID = ['Ahri'];
  assert.equal(readyMembers(room).length, 3);
  assert.equal(readyMembers(memberRoom(1)).length, 0);
  assert.equal(readyMembers(memberRoom(3, true, 'results')).length, 0);
});

test('Risultato stanza: serializzazione JSON senza riferimenti o campioni doppi nella comp', () => {
  const room = memberRoom(3);
  const members = readyMembers(room);
  const result = createSharedResult(members, 'creative', 'balanced');
  const restored = JSON.parse(JSON.stringify(result));
  assert.equal(restored.draw.length, 3);
  assert.equal(restored.players.length, 3);
  for (const row of restored.draw) {
    assert.notEqual(row.playerId, row.donorId);
    assert.notEqual(row.primary, row.secondary);
    assert.ok(restored.selections[row.playerId].primary.length > 0);
    assert.ok(restored.selections[row.playerId].primary.length <= 3);
  }
  for (const comp of restored.recommendations) {
    assert.equal(new Set(comp.picks.map((p) => p.id)).size, comp.picks.length);
    assert.equal(comp.picks.length, 3);
  }
});

test('Consigli delle rune/build sono scritti dal giocatore e vincolati a ruolo e campione', () => {
  const pool = { ...blankPools(), MID: ['Ahri', 'Annie'] };
  const notes = cleanAdvice({ MID: {
    Ahri: { runes: 'Elettroshock', items: 'Lich Bane -> Zhonya', notes: 'Contro assassini gioca safe.' },
    Zed: { runes: 'Conqueror' },
  } }, pool);
  assert.deepEqual(Object.keys(notes.MID), ['Ahri']);
  assert.equal(notes.MID.Ahri.runes, 'Elettroshock');
  assert.equal(notes.MID.Ahri.items, 'Lich Bane -> Zhonya');
  assert.equal(cleanAdvice({ MID: { Annie: { items: 'a'.repeat(700) } } }, pool).MID.Annie.items.length, 400);
});

test('Il risultato trasmette solo i consigli dei campioni estratti scritti dal proprietario della pool', () => {
  const donor = { id: 'donor', pools: { ...blankPools(), MID: ['Ahri','Annie'] },
    advice: { MID: { Ahri: { runes: 'Elettroshock' }, Annie: { runes: 'Cometa' } } } };
  const draw = [{ playerId: 'player', donorId: 'donor', primary: 'MID', secondary: 'TOP' }];
  const picks = { player: { primary: ['Ahri'], secondary: [] } };
  const notes = adviceForDraw(draw, [donor], picks, []);
  assert.equal(notes.player.MID.Ahri.runes, 'Elettroshock');
  assert.equal(notes.player.MID.Annie, undefined);
  assert.equal(notes.player.TOP, undefined);
});

test('Le regole RTDB sono JSON valido, private per stanza, con owner per membro', () => {
  const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
  assert.match(rules.rules.rooms.$room['.read'], /auth != null/);
  assert.match(rules.rules.rooms.$room.members.$uid['.write'], /auth.uid === \$uid/);
  assert.match(rules.rules.rooms.$room.result['.write'], /hostUid/);
});

test('Le regole cloud proteggono il profilo per UID e ammettono i consigli di pool', () => {
  const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
  assert.match(rules.rules.privateProfiles.$uid['.read'], /auth.uid === \$uid/);
  assert.match(rules.rules.privateProfiles.$uid['.write'], /auth.uid === \$uid/);
  assert.ok(rules.rules.rooms.$room.members.$uid.advice.$role.$champion.runes);
  assert.match(rules.rules.rooms.$room.meta['.validate'], /showAdvice/);
});
