import { ROLE_IDS } from './data.js';
import { shuffled } from './roulette.js';

// Catalogo curatoriale per ruolo: l'algoritmo non inventa pick casuali su lane
// non plausibili. Le eccezioni sperimentali sono esplicitamente contrassegnate.
const ROLE_DATA = {
  TOP: `Aatrox:fighter,ad,drain,teamfight|Sett:fighter,ad,engage,frontline|Garen:fighter,ad,frontline|Darius:fighter,ad,drain|Fiora:duelist,ad,split|Camille:duelist,ad,dive,engage|Gwen:duelist,ap,split|Jax:duelist,ad,split|Ornn:tank,engage,frontline,cc,teamfight|Malphite:tank,engage,frontline,cc,teamfight|Sion:tank,engage,frontline,cc|Shen:tank,peel,frontline,global|Poppy:tank,peel,frontline,cc|Kennen:mage,ap,engage,teamfight|Rumble:mage,ap,teamfight,poke|Mordekaiser:fighter,ap,drain,frontline|Irelia:duelist,ad,dive|Yone:fighter,ad,dive,teamfight|Kled:fighter,ad,engage|Gnar:fighter,ad,engage,cc|Gragas:tank,ap,engage,cc|Kayle:carry,ap,scale|Teemo:mage,ap,poke,split|Quinn:marksman,ad,poke,split|Nasus:fighter,ad,split,scale|Warwick:fighter,ad,drain,frontline,offmeta|Soraka:enchanter,ap,heal,offmeta`,
  JUNGLE: `Viego:fighter,ad,dive,reset|LeeSin:fighter,ad,engage,early|Warwick:fighter,ad,drain,engage|Diana:assassin,ap,engage,teamfight|Lillia:mage,ap,teamfight,cc,scale|Kindred:marksman,ad,scale,peel|JarvanIV:fighter,ad,engage,teamfight,cc|Vi:fighter,ad,engage,cc,dive|Sejuani:tank,engage,frontline,cc|Amumu:tank,ap,engage,frontline,cc,teamfight|Zac:tank,ap,engage,frontline,cc|Rammus:tank,engage,frontline,cc|Maokai:tank,ap,engage,cc,frontline|Nocturne:assassin,ad,dive,global|Kayn:assassin,ad,dive|Khazix:assassin,ad,dive|Evelynn:assassin,ap,dive|Ekko:assassin,ap,dive|Taliyah:mage,ap,poke,cc|Graves:marksman,ad,scale|Hecarim:fighter,ad,engage,dive|MonkeyKing:fighter,ad,engage,teamfight|Brand:mage,ap,poke,teamfight|Fiddlesticks:mage,ap,engage,teamfight|Briar:fighter,ad,drain,dive|Poppy:tank,ad,peel,cc|Morgana:mage,ap,cc,peel,offmeta|Zyra:mage,ap,poke,cc,offmeta|Rumble:mage,ap,teamfight,offmeta`,
  MID: `Ahri:mage,ap,cc,dive,pick|Yasuo:fighter,ad,dive,teamfight|Syndra:mage,ap,poke,burst,cc|Orianna:mage,ap,teamfight,cc,scale|Aurora:mage,ap,dive,teamfight|Lux:mage,ap,poke,cc|Sylas:fighter,ap,dive,drain|Viktor:mage,ap,poke,scale|Veigar:mage,ap,cc,scale,burst|Annie:mage,ap,burst,engage,cc|Hwei:mage,ap,poke,cc,teamfight|Azir:mage,ap,scale,teamfight|Vex:mage,ap,burst,cc|Zed:assassin,ad,dive,burst|Talon:assassin,ad,dive,burst|Qiyana:assassin,ad,engage,teamfight|Akali:assassin,ap,dive|Katarina:assassin,ap,dive,reset|Fizz:assassin,ap,dive,burst|Leblanc:assassin,ap,dive,burst|Taliyah:mage,ap,cc,poke|Galio:tank,ap,engage,peel,global|TwistedFate:mage,ap,pick,global|Zoe:mage,ap,poke,pick|Xerath:mage,ap,poke|Ziggs:mage,ap,poke|Anivia:mage,ap,cc,scale|Cassiopeia:mage,ap,drain,scale|Yone:fighter,ad,dive,teamfight|Irelia:duelist,ad,dive|Malphite:tank,ap,engage,teamfight,offmeta|Nautilus:tank,ap,engage,cc,offmeta|Tristana:marksman,ad,dive,offmeta|Brand:mage,ap,poke,teamfight,offmeta`,
  ADC: `Jinx:marksman,ad,scale,reset|Caitlyn:marksman,ad,poke,range|Ezreal:marksman,ad,poke,mobility|Kaisa:marksman,ad,dive,scale|Xayah:marksman,ad,peel,scale|MissFortune:marksman,ad,teamfight|Jhin:marksman,ad,pick,poke|Varus:marksman,ad,poke,cc|Ashe:marksman,ad,engage,cc,pick|Aphelios:marksman,ad,scale,teamfight|Zeri:marksman,ad,scale,mobility|Lucian:marksman,ad,early,dive|Draven:marksman,ad,early|Samira:marksman,ad,dive,reset|Nilah:marksman,ad,dive,scale|Vayne:marksman,ad,scale,duelist|Twitch:marksman,ad,scale,teamfight|Sivir:marksman,ad,teamfight,scale|KogMaw:marksman,ad,scale|Tristana:marksman,ad,scale,dive|Kalista:marksman,ad,early,engage|Smolder:marksman,ad,scale|Ziggs:mage,ap,poke,teamfight,offmeta|Seraphine:mage,ap,peel,cc,teamfight,offmeta|Swain:mage,ap,drain,frontline,offmeta|Karthus:mage,ap,teamfight,offmeta|Veigar:mage,ap,scale,cc,offmeta`,
  SUPPORT: `Thresh:tank,engage,peel,cc,pick|Nautilus:tank,engage,frontline,cc|Lux:mage,ap,poke,cc|Seraphine:enchanter,ap,heal,cc,teamfight|Lulu:enchanter,ap,peel,heal|Nami:enchanter,ap,heal,cc|Rakan:tank,engage,peel,cc,teamfight|Leona:tank,engage,frontline,cc|Braum:tank,peel,frontline,cc|Janna:enchanter,ap,peel,heal|Soraka:enchanter,ap,heal,peel|Milio:enchanter,ap,heal,peel|Sona:enchanter,ap,heal,teamfight|Yuumi:enchanter,ap,heal,peel|Renata:enchanter,ap,peel,cc,teamfight|Bard:enchanter,ap,engage,cc,pick|Blitzcrank:tank,engage,pick,cc|Pyke:assassin,ad,engage,pick,reset|Alistar:tank,engage,frontline,cc|Rell:tank,engage,frontline,cc,teamfight|Maokai:tank,engage,cc,peel|Zyra:mage,ap,poke,cc|Brand:mage,ap,poke,teamfight|Karma:enchanter,ap,poke,peel|Morgana:mage,ap,peel,cc|Senna:marksman,ad,peel,scale|Swain:mage,ap,drain,cc|Pantheon:fighter,ad,engage,cc,offmeta|Poppy:tank,peel,cc,offmeta|Ashe:marksman,ad,poke,cc,offmeta|Heimerdinger:mage,ap,poke,offmeta|Shen:tank,peel,cc,offmeta|Neeko:mage,ap,engage,cc,offmeta`,
};

export const ROLE_ROSTER = Object.fromEntries(Object.entries(ROLE_DATA).map(([role, lines]) => [
  role, lines.split('|').map((part) => {
    const [id, raw] = part.split(':');
    const tags = raw.split(',');
    return { id, tags: tags.filter((tag) => tag !== 'offmeta'), offmeta: tags.includes('offmeta') };
  }),
]));

const TAG_IT = { fighter: 'combattimento prolungato', assassin: 'burst', marksman: 'DPS', mage: 'danni magici', tank: 'resistenza', enchanter: 'utility', duelist: 'duello', carry: 'scaling', ad: 'danni fisici', ap: 'danni magici', frontline: 'frontline', engage: 'ingaggio', cc: 'controllo', peel: 'protezione', poke: 'poke', pick: 'pick', dive: 'dive', drain: 'sustain', scale: 'scaling', reset: 'reset', heal: 'cure', mobility: 'mobilità', teamfight: 'teamfight', global: 'presenza globale', range: 'range', early: 'early game', split: 'split push', burst: 'burst' };

export function tagsFor(id, role) {
  const inRole = ROLE_ROSTER[role]?.find((entry) => entry.id === id);
  if (inRole) return inRole.tags;
  const others = Object.values(ROLE_ROSTER).flat().find((entry) => entry.id === id);
  return others?.tags ?? ['carry'];
}

function overlap(a, b) {
  const common = a.filter((tag) => b.includes(tag));
  return common.length / Math.max(1, new Set([...a, ...b]).size);
}

const PAIR_BONUSES = [
  ['Yasuo', 'Malphite'], ['Yasuo', 'Diana'], ['Yasuo', 'Orianna'], ['Yasuo', 'Rakan'],
  ['Samira', 'Nautilus'], ['Samira', 'Leona'], ['Samira', 'Rell'], ['Samira', 'Alistar'],
  ['Kaisa', 'Nautilus'], ['Kaisa', 'Leona'], ['Kaisa', 'Vi'],
  ['Jinx', 'Lulu'], ['Jinx', 'Thresh'], ['Jinx', 'Braum'],
  ['KogMaw', 'Lulu'], ['Twitch', 'Lulu'], ['Aphelios', 'Milio'],
  ['MissFortune', 'Amumu'], ['MissFortune', 'Leona'], ['MissFortune', 'Rell'],
  ['Orianna', 'JarvanIV'], ['Orianna', 'Wukong'], ['Orianna', 'MonkeyKing'],
  ['Galio', 'Camille'], ['Rakan', 'Xayah'], ['Lucian', 'Nami'],
  ['Caitlyn', 'Lux'], ['Caitlyn', 'Morgana'], ['Ashe', 'Seraphine'],
  ['Kalista', 'Renata'], ['Zeri', 'Lulu'], ['Varus', 'Zyra'],
];
const PAIR_SET = new Set(PAIR_BONUSES.map(([a,b]) => [a,b].sort().join(':')));

export function synergy(candidate, previous) {
  let result = 0;
  for (const pick of previous) {
    const a = candidate.tags, b = pick.tags;
    if (PAIR_SET.has([candidate.id, pick.id].sort().join(':'))) result += 5;
    if (a.includes('engage') && (b.includes('teamfight') || b.includes('dive'))) result += 1.8;
    if (b.includes('engage') && (a.includes('teamfight') || a.includes('dive'))) result += 1.8;
    if (a.includes('cc') && b.includes('poke')) result += 1.3;
    if (b.includes('cc') && a.includes('poke')) result += 1.3;
    if (a.includes('peel') && (b.includes('scale') || b.includes('marksman'))) result += 1.7;
    if (b.includes('peel') && (a.includes('scale') || a.includes('marksman'))) result += 1.7;
  }
  return Math.min(11, result);
}

export function candidateList(donor, role, tone, random) {
  const pool = [...new Set(donor.pools?.[role] || [])];
  const roster = ROLE_ROSTER[role] || [];
  const anchorTags = pool.map((id) => tagsFor(id, role));
  const options = [...roster, ...pool.filter((id) => !roster.some((entry) => entry.id === id)).map((id) => ({ id, tags: tagsFor(id, role), offmeta: false }))];
  return options.map((entry) => {
    const priority = pool.indexOf(entry.id);
    const isPool = priority !== -1;
    const likeness = isPool ? 1 : anchorTags.length ? Math.max(...anchorTags.map((tags) => overlap(entry.tags, tags))) : 0;
    const sourceBonus = isPool ? { faithful: 17, balanced: 2.5, offmeta: 3 }[tone] - priority * 1.4 : 0;
    const offmetaBonus = entry.offmeta ? { faithful: -13, balanced: -2, offmeta: 7 }[tone] : 0;
    const base = 3 + sourceBonus + 6 * likeness + offmetaBonus + random() * (tone === 'faithful' ? 1.5 : 5.4);
    const nearest = anchorTags.length ? pool[anchorTags.map((tags) => overlap(entry.tags, tags)).indexOf(likeness)] : null;
    return { ...entry, role, isPool, priority, likeness, nearest, base };
  }).sort((a, b) => b.base - a.base).slice(0, 16);
}

export function teamBalance(picks) {
  const total = picks.length;
  const has = (tag) => picks.filter((p) => p.tags.includes(tag)).length;
  let score = 0;
  if (total >= 3) {
    if (has('frontline') || has('engage')) score += 3;
    if (has('ap') && has('ad')) score += 4;
    if (has('cc')) score += 2;
    if (has('peel') && has('scale')) score += 2;
    if (has('ap') === total || has('ad') === total) score -= 5;
    if (!has('frontline') && !has('engage')) score -= 2;
  }
  return score;
}

export function whyPick(pick, otherPicks) {
  if (pick.isPool) return `Pool di priorità ${pick.priority + 1}`;
  const partner = otherPicks.find((p) => PAIR_SET.has([pick.id, p.id].sort().join(':')));
  if (partner) return `Combo con ${partner.id}`;
  if (pick.nearest) {
    const common = pick.tags.find((tag) => tagsFor(pick.nearest, pick.role).includes(tag) && TAG_IT[tag]);
    return `Alternativa a ${pick.nearest}${common ? ` · ${TAG_IT[common]}` : ''}`;
  }
  const ally = otherPicks.find((p) => p.tags.includes('engage') && (pick.tags.includes('teamfight') || pick.tags.includes('dive')));
  if (ally) return `Sinergia con ${ally.id}`;
  return 'Pick per completare la comp';
}

export function determineStyle(picks) {
  const count = (tag) => picks.filter((p) => p.tags.includes(tag)).length;
  const styles = [
    { label: 'Teamfight', description: 'Ingaggio e abilità ad area per i combattimenti di squadra.', score: count('teamfight') * 2 + count('engage') + count('cc') },
    { label: 'Pick & engage', description: 'Cerca un bersaglio isolato e ingaggia in vantaggio numerico.', score: count('pick') * 2 + count('engage') + count('cc') },
    { label: 'Poke & controllo', description: 'Consuma gli avversari da lontano prima di forzare l’obiettivo.', score: count('poke') * 2 + count('cc') + count('peel') },
    { label: 'Dive', description: 'Entra aggressivamente sulla backline con campioni mobili.', score: count('dive') * 2 + count('engage') },
    { label: 'Scaling & protezione', description: 'Proteggi i carry e gioca per i teamfight tardivi.', score: count('scale') * 2 + count('peel') + count('frontline') },
  ];
  return styles.sort((a, b) => b.score - a.score)[0];
}

/**
 * Mantiene l'assegnazione di ruoli / prestatori della roulette classica.
 * Una ricerca beam sceglie 1 champion per ruolo primario senza duplicati,
 * considerando priorità pool, affinità dei tag e sinergie con gli altri pick.
 */
export function generateCreativeComp(draw, players, tone = 'balanced', random = Math.random) {
  if (!['faithful', 'balanced', 'offmeta'].includes(tone)) throw new Error('Stile non valido.');
  if (!Array.isArray(draw) || draw.length < 2 || draw.length > 5) throw new Error('Lobby non valida.');
  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = draw.map((entry) => {
    const donor = byId.get(entry.donorId);
    if (!donor || !byId.has(entry.playerId) || entry.donorId === entry.playerId || !ROLE_IDS.includes(entry.primary)) throw new Error('Sorteggio non valido.');
    return { ...entry, options: candidateList(donor, entry.primary, tone, random) };
  });
  let beam = [{ picks: [], used: new Set(), score: 0 }];
  for (const row of rows) {
    const next = [];
    for (const state of beam) {
      for (const option of row.options) {
        if (state.used.has(option.id)) continue;
        const picks = [...state.picks, { ...option, playerId: row.playerId, donorId: row.donorId, primary: row.primary, secondary: row.secondary }];
        next.push({ picks, used: new Set([...state.used, option.id]), score: state.score + option.base + synergy(option, state.picks) });
      }
    }
    if (!next.length) throw new Error('Nessuna composizione valida.');
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, 65);
  }
  beam.sort((a, b) => b.score + teamBalance(b.picks) - a.score - teamBalance(a.picks));
  const best = beam[0];
  const taken = new Set(best.picks.map((p) => p.id));
  const picks = best.picks.map((pick) => {
    const donor = byId.get(pick.donorId);
    const alternatives = candidateList(donor, pick.secondary, tone, random)
      .filter((candidate) => !taken.has(candidate.id))
      .slice(0, 1);
    return { ...pick, reason: whyPick(pick, best.picks.filter((p) => p.id !== pick.id)), secondaryChoice: alternatives[0] ? {
      id: alternatives[0].id, isPool: alternatives[0].isPool,
    } : null };
  });
  return { picks, style: determineStyle(picks), tone, partial: picks.length < 5 };
}
