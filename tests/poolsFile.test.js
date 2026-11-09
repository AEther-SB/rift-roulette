import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYERS } from '../src/data.js';
import { createPoolsFile, parsePoolsFile } from '../src/poolsFile.js';

const state = {
  players: structuredClone(DEFAULT_PLAYERS),
  lobbyIds: ['calo', 'aria', 'nox'],
  selectedId: 'calo',
};

test('Il backup JSON conserva i profili, le 5 pool e le priorità dei campioni', () => {
  const json = createPoolsFile(state, new Date('2026-11-08T13:00:00Z'));
  const recovered = parsePoolsFile(json);
  assert.deepEqual(recovered, state);
  assert.match(json, /rift-roulette-pools/);
});

test('Il file esportato importa correttamente nomi con caratteri Unicode', () => {
  const data = structuredClone(state);
  data.players[0].name = 'Calò 🎮';
  assert.equal(parsePoolsFile(createPoolsFile(data)).players[0].name, 'Calò 🎮');
});

test('Il JSON non valido viene rifiutato', () => {
  assert.throws(() => parsePoolsFile('non-json'), /JSON valido/);
  assert.throws(() => parsePoolsFile('{}'), /Formato non supportato/);
});

test('Accetta pool di qualsiasi dimensione e rifiuta campioni duplicati', () => {
  const file = JSON.parse(createPoolsFile(state));
  file.state.players[0].pools.TOP = ['Aatrox', 'Sett', 'Garen', 'Teemo'];
  assert.equal(parsePoolsFile(JSON.stringify(file)).players[0].pools.TOP.length, 4);
  file.state.players[0].pools.TOP = ['Aatrox', 'Aatrox'];
  assert.throws(() => parsePoolsFile(JSON.stringify(file)), /Pool TOP/);
});

test('Rifiuta profili con lo stesso ID', () => {
  const file = JSON.parse(createPoolsFile(state));
  file.state.players[1].id = file.state.players[0].id;
  assert.throws(() => parsePoolsFile(JSON.stringify(file)), /profilo 2/);
});

test('Importa una selezione lobby pulita da ID non più presenti', () => {
  const file = JSON.parse(createPoolsFile(state));
  file.state.lobbyIds = ['calo', 'missing', 'calo', 'nox'];
  const result = parsePoolsFile(JSON.stringify(file));
  assert.deepEqual(result.lobbyIds, ['calo', 'nox']);
});


test('Backup con 50 campioni nello stesso ruolo conservato integralmente', () => {
  const file = JSON.parse(createPoolsFile(state));
  file.state.players[0].pools.MID = Array.from({ length: 50 }, (_, index) => `Champion${index}`);
  const result = parsePoolsFile(JSON.stringify(file));
  assert.equal(result.players[0].pools.MID.length, 50);
});

test('Backup personale conserva rune, oggetti e note senza perderli', () => {
  const withGuides = structuredClone(state);
  withGuides.players[0].advice = {
    MID: { Ahri: { runes: 'Elettroshock', items: 'Lich Bane e Zhonya', notes: 'Personalizza contro il matchup' } },
  };
  if (!withGuides.players[0].pools.MID.includes('Ahri')) withGuides.players[0].pools.MID.push('Ahri');
  const backup = createPoolsFile(withGuides);
  const restored = parsePoolsFile(backup);
  assert.equal(restored.players[0].advice.MID.Ahri.runes, 'Elettroshock');
  assert.equal(restored.players[0].advice.MID.Ahri.items, 'Lich Bane e Zhonya');
  assert.equal(restored.players[0].advice.MID.Ahri.notes, 'Personalizza contro il matchup');
});

test('Non importa guide per campioni fuori pool', () => {
  const file = JSON.parse(createPoolsFile(state));
  file.state.players[0].advice = { MID: { CampioneInventato: { items: 'Oggetto inventato' } } };
  const restored = parsePoolsFile(JSON.stringify(file));
  assert.deepEqual(restored.players[0].advice, {});
});
