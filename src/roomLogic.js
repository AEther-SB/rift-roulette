import { ACCENTS, ROLE_IDS, blankPools } from './data.js';
import { generateDraw } from './roulette.js';
import { generateRoleSelections, generateRecommendedComps, validateLobbyPools } from './recommendations.js';
import { normalizeRunePage } from './gameAssets.js';

export const PROFILE_KEY = 'rift-roulette-own-profile-v1';
export const ROOM_SIZE_LIMIT = 5;
export const ADVICE_TEXT_LIMIT = 400;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(randomBytes) {
  const bytes = randomBytes ?? globalThis.crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('');
}

export function cleanRoomCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8);
}

// I consigli sono testo scritto dagli utenti: mai derivati automaticamente da patch/winrate.
export function cleanAdvice(value, pools) {
  const advice = {};
  for (const role of ROLE_IDS) {
    const suggestions = {};
    for (const champion of pools[role] || []) {
      const entry = value?.[role]?.[champion];
      if (!entry || typeof entry !== 'object') continue;
      const clean = {};
      for (const field of ['runes', 'items', 'notes']) {
        const text = typeof entry[field] === 'string' ? entry[field].trim().slice(0, ADVICE_TEXT_LIMIT) : '';
        if (text) clean[field] = text;
      }
      const runePage = normalizeRunePage(entry.runePage);
      if (runePage) clean.runePage = runePage;
      const itemIds = [...new Set((Array.isArray(entry.itemIds) ? entry.itemIds : [])
        .filter((id) => typeof id === 'string' && /^[0-9]{3,6}$/.test(id)))].slice(0, 6);
      if (itemIds.length) clean.itemIds = itemIds;
      if (Object.keys(clean).length) suggestions[champion] = clean;
    }
    if (Object.keys(suggestions).length) advice[role] = suggestions;
  }
  return advice;
}

export function cleanOwnProfile(value) {
  const pools = blankPools();
  for (const role of ROLE_IDS) {
    pools[role] = [...new Set((Array.isArray(value?.pools?.[role]) ? value.pools[role] : [])
      .filter((id) => typeof id === 'string' && /^[a-z0-9]{1,40}$/i.test(id)))].slice(0, 300);
  }
  return {
    name: typeof value?.name === 'string' ? value.name.slice(0, 24) : 'user',
    accent: ACCENTS.includes(value?.accent) ? value.accent : ACCENTS[0],
    pools,
    advice: cleanAdvice(value?.advice, pools),
  };
}

export function isProfileComplete(profile) {
  return ROLE_IDS.every((role) => Array.isArray(profile?.pools?.[role]) && profile.pools[role].length > 0);
}

export function readyMembers(room) {
  if (room?.meta?.phase !== 'waiting') return [];
  const members = Object.entries(room.members || {});
  if (members.length < 2 || members.length > ROOM_SIZE_LIMIT) return [];
  if (!members.every(([, member]) => member.online === true &&
    member.readyRound === room.meta.round && isProfileComplete(member))) return [];
  return members.map(([id, member]) => ({ id, ...cleanOwnProfile(member) }));
}

export function getRoomMembers(room) {
  return Object.entries(room?.members || {}).map(([id, member]) => ({ id, ...member }));
}

// Espone soltanto i consigli dei campioni effettivamente usciti nel roll.
export function adviceForDraw(draw, players, selections, recommendations) {
  const output = {};
  for (const assignment of draw) {
    const donor = players.find((player) => player.id === assignment.donorId);
    if (!donor) continue;
    const roleAdvice = {};
    for (const kind of ['primary', 'secondary']) {
      const role = assignment[kind];
      const picks = new Set(selections?.[assignment.playerId]?.[kind] || []);
      for (const comp of recommendations || []) {
        for (const pick of comp.picks || []) {
          if (pick.playerId === assignment.playerId && pick.primary === role) picks.add(pick.id);
        }
      }
      const notes = {};
      for (const id of picks) {
        const guide = donor.advice?.[role]?.[id];
        if (guide && (donor.pools?.[role] || []).includes(id)) notes[id] = guide;
      }
      if (Object.keys(notes).length) roleAdvice[role] = notes;
    }
    if (Object.keys(roleAdvice).length) output[assignment.playerId] = roleAdvice;
  }
  return output;
}

export function createSharedResult(players, mode = 'classic', tone = 'balanced', random = Math.random) {
  validateLobbyPools(players);
  const draw = generateDraw(players, random);
  const selections = generateRoleSelections(draw, players, random);
  const recommendations = generateRecommendedComps(draw, players, selections, mode, tone, random);
  return {
    players: players.map((p) => ({ id: p.id, name: p.name, accent: p.accent })),
    draw,
    selections,
    advice: adviceForDraw(draw, players, selections, recommendations),
    recommendations: recommendations.map((comp) => ({
      id: comp.id,
      label: comp.label,
      style: { label: comp.style.label, description: comp.style.description },
      partial: Boolean(comp.partial),
      picks: comp.picks.map((pick) => ({
        id: pick.id, primary: pick.primary, playerId: pick.playerId,
        isPool: Boolean(pick.isPool), reason: pick.reason,
      })),
    })),
  };
}

