/** Dati grafici ufficiali Riot: solo catalogo, mai consigli calcolati. */
export function normalizeRunes(raw) {
  return (Array.isArray(raw) ? raw : []).filter((tree) => Number.isInteger(tree.id) && Array.isArray(tree.slots)).map((tree) => ({
    id: tree.id,
    name: tree.name,
    icon: tree.icon,
    slots: tree.slots.map((slot) => (slot.runes || []).map((rune) => ({ id: rune.id, name: rune.name, icon: rune.icon, shortDesc: rune.shortDesc || '' }))),
  }));
}

export function normalizeItems(raw) {
  return Object.entries(raw?.data || {}).filter(([id, item]) =>
    /^[0-9]{3,6}$/.test(id) && item?.maps?.['11'] === true && item.gold?.purchasable !== false && item.inStore !== false && item.image?.full
  ).map(([id, item]) => ({ id, name: item.name, icon: item.image.full, price: item.gold?.total || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export function runeIconUrl(icon) {
  if (typeof icon !== 'string' || !/^perk-images\/[A-Za-z0-9_./-]+\.png$/.test(icon)) return '';
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
}

export function itemIconUrl(id, version) {
  if (!/^[0-9]{3,6}$/.test(String(id))) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(version)}/img/item/${id}.png`;
}

export function normalizeRunePage(input, availableTrees = []) {
  if (!input || typeof input !== 'object') return null;
  const treeById = new Map(availableTrees.map((tree) => [tree.id, tree]));
  const primaryStyle = Number(input.primaryStyle) || 0;
  const secondaryStyle = Number(input.secondaryStyle) || 0;
  const tree = treeById.get(primaryStyle);
  const secondaryTree = treeById.get(secondaryStyle);
  const primary = (Array.isArray(input.primary) ? input.primary : []).map(Number).filter((id) => Number.isInteger(id));
  const secondary = (Array.isArray(input.secondary) ? input.secondary : []).map(Number).filter((id) => Number.isInteger(id));
  if (!primaryStyle && !secondaryStyle && !primary.length && !secondary.length) return null;
  // Con catalogo Riot: accetta solo le rune effettive dell'albero selezionato e della riga corretta.
  const cleanPrimary = tree ? Array.from({ length: 4 }, (_, i) => tree.slots[i]?.some((r) => r.id === primary[i]) ? primary[i] : 0) : primary.slice(0, 4);
  const cleanSecondary = secondaryTree && secondaryTree.id !== tree?.id ? secondary.filter((id) => secondaryTree.slots.slice(1).some((slot) => slot.some((r) => r.id === id))).slice(0, 2) : secondary.slice(0, 2);
  return { primaryStyle, secondaryStyle: secondaryStyle === primaryStyle ? 0 : secondaryStyle, primary: cleanPrimary, secondary: [...new Set(cleanSecondary)] };
}
