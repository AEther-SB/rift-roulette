import { ACCENTS, ROLE_IDS } from './data.js';
import { cleanAdvice } from './roomLogic.js';

const FILE_FORMAT = 'rift-roulette-pools';
const FILE_VERSION = 1;
const MAX_PROFILES = 100;
const CHAMPION_ID = /^[A-Za-z0-9]{1,40}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** JSON di backup: portabile tra browser, senza servizi online. */
export function createPoolsFile(state, exportedAt = new Date()) {
  const players = state.players.map((player, index) => ({
    id: player.id,
    name: player.name.trim() || `Giocatore ${index + 1}`,
    accent: player.accent,
    pools: Object.fromEntries(ROLE_IDS.map((role) => [role, [...(player.pools[role] || [])]])),
    ...(player.advice && Object.keys(player.advice).length ? { advice: cleanAdvice(player.advice, player.pools) } : {}),
  }));
  return JSON.stringify({
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: exportedAt.toISOString(),
    state: { players, lobbyIds: state.lobbyIds, selectedId: state.selectedId },
  }, null, 2) + '\n';
}

/** Controlli espliciti prima di sostituire i dati nel browser. */
export function parsePoolsFile(jsonText) {
  let backup;
  try {
    backup = JSON.parse(jsonText);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  if (!backup || backup.format !== FILE_FORMAT || backup.version !== FILE_VERSION) {
    throw new Error('Formato non supportato: seleziona un backup JSON di Rift Roulette.');
  }
  const state = backup.state;
  if (!state || !Array.isArray(state.players) || state.players.length < 1 || state.players.length > MAX_PROFILES) {
    throw new Error('Il backup non contiene un roster valido (massimo 100 profili).');
  }

  const ids = new Set();
  const players = state.players.map((player, index) => {
    if (!player || typeof player.id !== 'string' || !player.id || ids.has(player.id) ||
        typeof player.name !== 'string' || !player.name.trim() || player.name.length > 24 ||
        !player.pools || typeof player.pools !== 'object') {
      throw new Error(`Dati non validi nel profilo ${index + 1}.`);
    }
    ids.add(player.id);
    const pools = {};
    for (const role of ROLE_IDS) {
      const pool = player.pools[role];
      if (!Array.isArray(pool) ||
          pool.some((id) => typeof id !== 'string' || !CHAMPION_ID.test(id)) ||
          new Set(pool).size !== pool.length) {
        throw new Error(`Pool ${role} non valida per ${player.name}.`);
      }
      pools[role] = [...pool];
    }
    return {
      id: player.id,
      name: player.name,
      accent: HEX_COLOR.test(player.accent) ? player.accent : ACCENTS[index % ACCENTS.length],
      pools,
      ...(player.advice && Object.keys(player.advice).length ? { advice: cleanAdvice(player.advice, pools) } : {}),
    };
  });

  const lobbyIds = Array.isArray(state.lobbyIds)
    ? [...new Set(state.lobbyIds)].filter((id) => ids.has(id)).slice(0, 5)
    : players.slice(0, 3).map((player) => player.id);

  return {
    players,
    lobbyIds,
    selectedId: ids.has(state.selectedId) ? state.selectedId : players[0].id,
  };
}
