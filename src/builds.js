import { tagsFor } from './creative.js';

// Esempi teorici e tematici, non estratti da win rate, matchup o build live.
// Nome degli oggetti/rune confrontato con Data Dragon ad ogni aggiornamento.
const STYLES = {
  fighter: {
    label: 'Bruiser · combattimento lungo',
    primary: ['Precision', 'Conqueror', 'Triumph', 'Legend: Haste', 'Last Stand'],
    secondary: ['Resolve', 'Bone Plating', 'Overgrowth'],
    items: ['Sundered Sky', 'Black Cleaver', 'Sterak\'s Gage', 'Death\'s Dance'],
    tip: 'Trades lunghi, sustain e ingresso sul secondo tempo del fight.',
  },
  duelist: {
    label: 'Duelist · sidelane',
    primary: ['Resolve', 'Grasp of the Undying', 'Demolish', 'Second Wind', 'Overgrowth'],
    secondary: ['Precision', 'Legend: Alacrity', 'Last Stand'],
    items: ['Trinity Force', 'Ravenous Hydra', 'Spear of Shojin', 'Sterak\'s Gage'],
    tip: 'Pressione laterale e 1v1: non è una build universale per ogni matchup.',
  },
  tank: {
    label: 'Tank · engage',
    primary: ['Resolve', 'Aftershock', 'Font of Life', 'Conditioning', 'Overgrowth'],
    secondary: ['Inspiration', 'Magical Footwear', 'Cosmic Insight'],
    items: ['Sunfire Aegis', 'Unending Despair', 'Thornmail', 'Kaenic Rookern'],
    tip: 'Frontline, gestione del CC e resistenze da adattare ai danni nemici.',
  },
  tankTop: {
    label: 'Tank · corsia',
    primary: ['Resolve', 'Grasp of the Undying', 'Demolish', 'Second Wind', 'Overgrowth'],
    secondary: ['Inspiration', 'Magical Footwear', 'Cosmic Insight'],
    items: ['Sunfire Aegis', 'Unending Despair', 'Thornmail', 'Kaenic Rookern'],
    tip: 'Danni minimi e resistenze, da variare secondo matchup AD/AP.',
  },
  engage: {
    label: 'Support · ingaggio',
    primary: ['Resolve', 'Aftershock', 'Font of Life', 'Bone Plating', 'Unflinching'],
    secondary: ['Inspiration', 'Hextech Flashtraption', 'Cosmic Insight'],
    items: ['Locket of the Iron Solari', 'Knight\'s Vow', 'Zeke\'s Convergence', 'Redemption'],
    tip: 'Cerca una finestra di engage e proteggi il carry dopo l’ingresso.',
  },
  enchanter: {
    label: 'Enchanter · peel',
    primary: ['Sorcery', 'Summon Aery', 'Manaflow Band', 'Transcendence', 'Scorch'],
    secondary: ['Resolve', 'Bone Plating', 'Revitalize'],
    items: ['Moonstone Renewer', 'Ardent Censer', 'Redemption', 'Dawncore'],
    tip: 'Cure, scudi e sopravvivenza del carry: valuta l’utilità situazionale.',
  },
  apBurst: {
    label: 'AP · burst',
    primary: ['Domination', 'Electrocute', 'Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondary: ['Sorcery', 'Manaflow Band', 'Transcendence'],
    items: ['Luden\'s Companion', 'Shadowflame', 'Rabadon\'s Deathcap', 'Void Staff'],
    tip: 'Punta a colpire un bersaglio fragile con una rotazione di abilità.',
  },
  apControl: {
    label: 'AP · controllo',
    primary: ['Sorcery', 'Summon Aery', 'Manaflow Band', 'Transcendence', 'Scorch'],
    secondary: ['Precision', 'Presence of Mind', 'Cut Down'],
    items: ['Blackfire Torch', 'Liandry\'s Torment', 'Rabadon\'s Deathcap', 'Void Staff'],
    tip: 'Poke, zona e danni prolungati: considera la penetrazione magica.',
  },
  apPoke: {
    label: 'AP · poke',
    primary: ['Sorcery', 'Arcane Comet', 'Manaflow Band', 'Transcendence', 'Scorch'],
    secondary: ['Inspiration', 'Magical Footwear', 'Cosmic Insight'],
    items: ['Luden\'s Companion', 'Horizon Focus', 'Rabadon\'s Deathcap', 'Void Staff'],
    tip: 'Range, pressione sulla wave e spell da lontano prima dell’engage.',
  },
  assassin: {
    label: 'Assassin · pick',
    primary: ['Domination', 'Electrocute', 'Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondary: ['Sorcery', 'Transcendence', 'Scorch'],
    items: ['Youmuu\'s Ghostblade', 'Opportunity', 'Edge of Night', 'Serylda\'s Grudge'],
    tip: 'Massimizza i pick isolati; gli oggetti difensivi dipendono dai nemici.',
  },
  apAssassin: {
    label: 'Assassin · AP',
    primary: ['Domination', 'Electrocute', 'Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondary: ['Sorcery', 'Transcendence', 'Scorch'],
    items: ['Lich Bane', 'Stormsurge', 'Rabadon\'s Deathcap', 'Void Staff'],
    tip: 'Finestra di burst e riposizionamento, evitando scambi troppo lunghi.',
  },
  adcCrit: {
    label: 'ADC · critici',
    primary: ['Precision', 'Lethal Tempo', 'Presence of Mind', 'Legend: Alacrity', 'Cut Down'],
    secondary: ['Inspiration', 'Magical Footwear', 'Cosmic Insight'],
    items: ['Infinity Edge', 'Phantom Dancer', 'Lord Dominik\'s Regards', 'Bloodthirster'],
    tip: 'DPS costante e posizionamento: adatta la scelta all’armatura avversaria.',
  },
  adcOnHit: {
    label: 'ADC · on-hit',
    primary: ['Precision', 'Lethal Tempo', 'Presence of Mind', 'Legend: Alacrity', 'Cut Down'],
    secondary: ['Resolve', 'Bone Plating', 'Overgrowth'],
    items: ['Kraken Slayer', 'Guinsoo\'s Rageblade', 'Blade of the Ruined King', 'Wit\'s End'],
    tip: 'On-hit e DPS progressivo: spesso efficace con peel dedicato.',
  },
  apc: {
    label: 'APC · bot sperimentale',
    primary: ['Sorcery', 'Arcane Comet', 'Manaflow Band', 'Transcendence', 'Scorch'],
    secondary: ['Precision', 'Presence of Mind', 'Cut Down'],
    items: ['Blackfire Torch', 'Liandry\'s Torment', 'Rabadon\'s Deathcap', 'Void Staff'],
    tip: 'Corsia bot con danni magici: controlla che il resto della comp abbia AD.',
  },
  offmetaAD: {
    label: 'Support AD · sperimentale',
    primary: ['Domination', 'Hail of Blades', 'Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondary: ['Resolve', 'Bone Plating', 'Unflinching'],
    items: ['Umbral Glaive', 'Youmuu\'s Ghostblade', 'Edge of Night', 'Black Cleaver'],
    tip: 'Trade aggressivi: occhio all’economia ridotta del support.',
  },
};

const OVERRIDES = {
  'Malphite:MID': 'apBurst', 'Nautilus:MID': 'apBurst', 'Ziggs:ADC': 'apc',
  'Swain:ADC': 'apc', 'Seraphine:ADC': 'apc', 'Karthus:ADC': 'apc', 'Veigar:ADC': 'apc',
  'Ashe:SUPPORT': 'offmetaAD', 'Pantheon:SUPPORT': 'offmetaAD',
  'Senna:SUPPORT': 'adcCrit', 'Pyke:SUPPORT': 'assassin',
  'Teemo:TOP': 'apPoke', 'Kennen:TOP': 'apControl', 'Rumble:TOP': 'apControl',
  'Brand:JUNGLE': 'apControl', 'Morgana:JUNGLE': 'apControl', 'Zyra:JUNGLE': 'apControl',
  'Rumble:JUNGLE': 'apControl', 'Diana:JUNGLE': 'apAssassin',
};

function inferStyle(id, role) {
  if (OVERRIDES[`${id}:${role}`]) return OVERRIDES[`${id}:${role}`];
  const tags = tagsFor(id, role);
  if (role === 'ADC') return ['Kaisa', 'KogMaw', 'Vayne', 'Varus', 'Kalista'].includes(id) ? 'adcOnHit' : 'adcCrit';
  if (role === 'SUPPORT') {
    if (tags.includes('enchanter')) return 'enchanter';
    if (tags.includes('tank')) return 'engage';
    if (tags.includes('mage')) return tags.includes('poke') ? 'apPoke' : 'apControl';
  }
  if (tags.includes('duelist')) return 'duelist';
  if (tags.includes('tank')) return role === 'TOP' ? 'tankTop' : 'tank';
  if (tags.includes('assassin')) return tags.includes('ap') ? 'apAssassin' : 'assassin';
  if (tags.includes('mage')) return tags.includes('poke') ? 'apPoke' : tags.includes('burst') ? 'apBurst' : 'apControl';
  if (tags.includes('enchanter')) return 'enchanter';
  if (tags.includes('marksman')) return 'adcCrit';
  return 'fighter';
}

/** Restituisce un esempio di setup per il ruolo scelto, anche in assenza di rete. */
export function buildFor(id, role) {
  const key = inferStyle(id, role);
  return { ...STYLES[key], key, experimental: /sperimentale/.test(STYLES[key].label) || Boolean(OVERRIDES[`${id}:${role}`]) };
}

export function findRune(runes, name) {
  for (const tree of runes || []) {
    if (tree.name === name) return tree;
    for (const slot of tree.slots || []) {
      const rune = slot.runes?.find((r) => r.name === name);
      if (rune) return rune;
    }
  }
  return null;
}

/** Usa solo oggetti disponibili nella Summoner's Rift nell'ultima versione. */
export function findItem(items, name) {
  const entries = Object.entries(items || {});
  const match = entries.find(([, item]) => item.name === name && item.maps?.['11'] !== false && item.gold?.purchasable !== false);
  return match ? { id: match[0], name: match[1].name, image: match[1].image?.full || `${match[0]}.png` } : null;
}
