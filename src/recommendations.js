import { ROLE_IDS } from './data.js';
import { candidateList, determineStyle, synergy, tagsFor, teamBalance, whyPick } from './creative.js';

/** Un campione per ruolo è obbligatorio, ma non esiste un limite superiore. */
export function validateLobbyPools(activePlayers) {
  for (const player of activePlayers) {
    for (const role of ROLE_IDS) {
      if (!Array.isArray(player.pools?.[role]) || !player.pools[role].length) {
        throw new Error(`${player.name || 'Un giocatore'} deve inserire almeno 1 campione per ${role}.`);
      }
    }
  }
}

/** Pescata senza reinserimento: i primi campioni hanno più probabilità, non la certezza. */
export function sampleChampions(pool, limit = 3, random = Math.random) {
  const available = [...new Set(pool || [])].map((id, index) => ({ id, weight: 1 / Math.sqrt(index + 1) }));
  const output = [];
  const target = Math.min(limit, available.length);
  for (let i = 0; i < target; i++) {
    const total = available.reduce((sum, p) => sum + p.weight, 0);
    let needle = random() * total;
    let index = available.length - 1;
    for (let j = 0; j < available.length; j++) {
      needle -= available[j].weight;
      if (needle < 0) { index = j; break; }
    }
    output.push(available.splice(index, 1)[0].id);
  }
  return output;
}

/** Congela il risultato dell'estrazione: il render non può ripescare nuovi champion. */
export function generateRoleSelections(draw, players, random = Math.random) {
  const byId = new Map(players.map((p) => [p.id, p]));
  validateLobbyPools(draw.map((row) => byId.get(row.donorId)).filter(Boolean));
  return Object.fromEntries(draw.map((row) => {
    const donor = byId.get(row.donorId);
    if (!donor || !byId.has(row.playerId) || row.donorId === row.playerId ||
      !ROLE_IDS.includes(row.primary) || !ROLE_IDS.includes(row.secondary) || row.primary === row.secondary) {
      throw new Error('Sorteggio non valido.');
    }
    return [row.playerId, {
      primary: sampleChampions(donor.pools[row.primary], 3, random),
      secondary: sampleChampions(donor.pools[row.secondary], 3, random),
    }];
  }));
}

/** 1-3 formazioni diverse; mai doppioni di champion all'interno della stessa comp. */
export function generateRecommendedComps(draw, players, selections, mode = 'classic', tone = 'balanced', random = Math.random) {
  if (!['classic', 'creative'].includes(mode)) throw new Error('Modalità non valida.');
  if (!['faithful', 'balanced', 'offmeta'].includes(tone)) throw new Error('Stile non valido.');
  if (!draw.length || draw.length > 5) throw new Error('Lobby non valida.');
  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = draw.map((entry) => {
    const donor = byId.get(entry.donorId);
    const visible = selections[entry.playerId]?.primary;
    if (!donor || !Array.isArray(visible) || !visible.length) throw new Error('Pool non disponibile per la composizione.');
    const candidates = visible.map((id, index) => ({
      id, role: entry.primary, tags: tagsFor(id, entry.primary),
      isPool: true, inRoll: true, rollIndex: index,
      base: 7 - index * 1.7 + random() * 1.8,
    }));
    if (mode === 'creative') {
      const extras = candidateList(donor, entry.primary, tone, random);
      for (const extra of extras) {
        if (candidates.some((c) => c.id === extra.id)) continue;
        const base = (extra.isPool ? 3.6 : tone === 'offmeta' ? 5.1 : tone === 'faithful' ? -0.6 : 4)
          + extra.likeness * 4 + (extra.offmeta && tone === 'offmeta' ? 2 : 0) + random() * 2;
        candidates.push({ ...extra, inRoll: false, base });
        if (candidates.length >= 13) break;
      }
    }
    return { entry, candidates };
  });

  let beam = [{ picks: [], used: new Set(), score: 0 }];
  for (const row of rows) {
    const next = [];
    for (const state of beam) {
      for (const candidate of row.candidates) {
        if (state.used.has(candidate.id)) continue;
        const pick = { ...candidate, ...row.entry };
        next.push({
          picks: [...state.picks, pick],
          used: new Set([...state.used, pick.id]),
          score: state.score + candidate.base + synergy(candidate, state.picks),
        });
      }
    }
    if (!next.length) return []; // Ruoli estratti incompatibili: la roulette rimane utilizzabile.
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, 240);
  }

  const ranked = beam.map((candidate) => ({
    ...candidate, total: candidate.score + teamBalance(candidate.picks),
  })).sort((a, b) => b.total - a.total);
  const chosen = [];
  for (const candidate of ranked) {
    const signature = candidate.picks.map((p) => p.id).join(':');
    if (chosen.some((item) => item.signature === signature)) continue;
    if (chosen.length && ranked.length > 3) {
      const differences = candidate.picks.filter((p, i) => p.id !== chosen[0].picks[i].id).length;
      if (differences < Math.min(2, draw.length)) continue;
    }
    chosen.push({ ...candidate, signature });
    if (chosen.length === 3) break;
  }
  // Pool troppo strette: anche una sola composizione valida va mostrata.
  if (!chosen.length) chosen.push({ ...ranked[0], signature: ranked[0].picks.map((p) => p.id).join(':') });

  return chosen.map((state, index) => ({
    id: index + 1,
    label: index === 0 ? 'Consigliata' : `Alternativa ${index + 1}`,
    style: determineStyle(state.picks),
    partial: state.picks.length < 5,
    picks: state.picks.map((pick) => ({
      ...pick,
      reason: pick.inRoll ? (pick.rollIndex === 0 ? 'Campione principale estratto' : 'Alternativa estratta')
        : pick.isPool ? 'Altro campione della pool' : whyPick(pick, state.picks.filter((p) => p.id !== pick.id)),
    })),
  }));
}
