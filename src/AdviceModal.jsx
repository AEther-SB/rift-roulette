import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Crown, Package, Search, Trash2, X } from 'lucide-react';
import { getChampById, championImageUrl } from './data.js';
import { itemIconUrl, runeIconUrl } from './gameAssets.js';

const EMPTY_PAGE = { primaryStyle: 0, secondaryStyle: 0, primary: [0, 0, 0, 0], secondary: [] };

function GuideIcon({ src, label }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken
    ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
    : <span className="guide-icon-fallback" aria-hidden="true">{label.slice(0, 2)}</span>;
}

function IconPick({ src, label, selected, disabled, onClick, detail }) {
  return <button type="button" className={`guide-icon-pick ${selected ? 'chosen' : ''}`} disabled={disabled} title={label}
    aria-label={label} aria-pressed={selected} onClick={onClick}>
    <GuideIcon src={src} label={label} />
    <span>{label}</span>{detail && <small>{detail}</small>}
    {selected && <span className="guide-selected-mark"><Check size={12}/></span>}
  </button>;
}

export default function AdviceModal({ roleId, championId, profile, champions, version, assets, onSave, onClose }) {
  const champion = getChampById(championId, champions);
  const original = profile.advice?.[roleId]?.[championId] || {};
  const [tab, setTab] = useState('runes');
  const [draft, setDraft] = useState(() => ({
    runePage: { ...EMPTY_PAGE, ...(original.runePage || {}), primary: Array.from({length: 4}, (_, i) => Number(original.runePage?.primary?.[i]) || 0), secondary: [...(original.runePage?.secondary || [])] },
    itemIds: [...(original.itemIds || [])],
    runes: original.runes || '',
    items: original.items || '',
    notes: original.notes || '',
  }));
  const [query, setQuery] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  const runeTrees = assets.runes;
  const primaryTree = runeTrees.find((tree) => tree.id === draft.runePage.primaryStyle);
  const secondaryTree = runeTrees.find((tree) => tree.id === draft.runePage.secondaryStyle);
  const filteredItems = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('it');
    return assets.items.filter((item) => !search ||
      item.name.toLocaleLowerCase('it').includes(search) || item.id.includes(search));
  }, [assets.items, query]);
  const itemVersion = assets.itemVersion || version;

  function editPage(patch) { setDraft((old) => ({ ...old, runePage: { ...old.runePage, ...patch } })); }
  function selectPrimary(id) {
    editPage({ primaryStyle: id, primary: [0,0,0,0], ...(id === draft.runePage.secondaryStyle ? { secondaryStyle: 0, secondary: [] } : {}) });
  }
  function selectSecondary(id) { editPage({ secondaryStyle: id, secondary: [] }); }
  function selectPrimaryRune(row, id) {
    editPage({ primary: draft.runePage.primary.map((value, index) => index === row ? value === id ? 0 : id : value) });
  }
  function toggleSecondaryRune(id, row) {
    const current = draft.runePage.secondary;
    if (current.includes(id)) return editPage({ secondary: current.filter((value) => value !== id) });
    const usedSlots = new Set(current.map((value) => secondaryTree?.slots.findIndex((slot) => slot.some((rune) => rune.id === value))));
    if (usedSlots.has(row)) {
      return editPage({ secondary: [...current.filter((value) => secondaryTree?.slots[row]?.every((rune) => rune.id !== value)), id] });
    }
    if (current.length >= 2) return editPage({ secondary: [...current.slice(1), id] });
    return editPage({ secondary: [...current, id] });
  }
  function toggleItem(id) {
    setDraft((old) => ({ ...old, itemIds: old.itemIds.includes(id) ? old.itemIds.filter((value) => value !== id) : old.itemIds.length < 6 ? [...old.itemIds, id] : old.itemIds }));
  }
  function save() {
    onSave(roleId, championId, { runes: draft.runes, items: draft.items, notes: draft.notes,
      runePage: (draft.runePage.primaryStyle || draft.runePage.secondaryStyle) ? draft.runePage : undefined,
      itemIds: draft.itemIds });
    onClose();
  }

  return <div className="modal-backdrop guide-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="guide-modal" role="dialog" aria-modal="true" aria-label={`Consigli personali per ${champion.name} ${roleId}`}>
      <header className="guide-header">
        <div className="guide-champ-avatar"><img src={championImageUrl(champion, version)} alt="" /></div>
        <div className="guide-header-text"><small><BookOpen size={13}/> GUIDA PERSONALE · {roleId}</small><h2>{champion.name}</h2><p>Rune, oggetti e note scelti da te · nessun suggerimento automatico</p></div>
        <button type="button" className="guide-close" onClick={onClose} aria-label="Chiudi guida"><X size={20}/></button>
      </header>
      <nav className="guide-tabs" aria-label="Sezioni guida">
        <button type="button" className={tab === 'runes' ? 'current' : ''} onClick={() => setTab('runes')}><Crown size={16}/> Rune</button>
        <button type="button" className={tab === 'items' ? 'current' : ''} onClick={() => setTab('items')}><Package size={16}/> Oggetti</button>
        <button type="button" className={tab === 'notes' ? 'current' : ''} onClick={() => setTab('notes')}><BookOpen size={16}/> Note</button>
      </nav>
      <div className="guide-content">
        {tab === 'runes' && <>
          <div className="guide-section-head"><strong>Ramo principale</strong><span>Scegli un albero e una runa per riga</span></div>
          {runeTrees.length ? <>
            <div className="guide-tree-row">{runeTrees.map((tree) => <button key={tree.id} type="button" className={`guide-tree ${draft.runePage.primaryStyle === tree.id ? 'selected' : ''}`} onClick={() => selectPrimary(tree.id)} title={tree.name} aria-pressed={draft.runePage.primaryStyle === tree.id}>
              <img alt="" src={runeIconUrl(tree.icon)}/><span>{tree.name}</span>
            </button>)}</div>
            {primaryTree ? <div className="guide-rune-rows">{primaryTree.slots.map((slot, row) => <div className="guide-rune-row" key={row}>
              <small>{row === 0 ? 'CHIAVE' : `RIGA ${row + 1}`}</small>
              <div>{slot.map((rune) => <IconPick key={rune.id} src={runeIconUrl(rune.icon)} label={rune.name} selected={draft.runePage.primary[row] === rune.id} onClick={() => selectPrimaryRune(row, rune.id)}/>)}</div>
            </div>)}</div> : <p className="guide-instruction">Seleziona il ramo principale per vedere le rune.</p>}
            <div className="guide-section-head secondary-head"><strong>Ramo secondario</strong><span>Scegli due rune di righe diverse</span></div>
            <div className="guide-tree-row">{runeTrees.filter((tree) => tree.id !== draft.runePage.primaryStyle).map((tree) => <button key={tree.id} type="button" className={`guide-tree ${draft.runePage.secondaryStyle === tree.id ? 'selected' : ''}`} onClick={() => selectSecondary(tree.id)} title={tree.name} aria-pressed={draft.runePage.secondaryStyle === tree.id}>
              <img alt="" src={runeIconUrl(tree.icon)}/><span>{tree.name}</span>
            </button>)}</div>
            {secondaryTree && <div className="guide-rune-rows">{secondaryTree.slots.slice(1).map((slot, i) => <div className="guide-rune-row" key={i}>
              <small>RIGA {i + 2}</small><div>{slot.map((rune) => <IconPick key={rune.id} src={runeIconUrl(rune.icon)} label={rune.name} selected={draft.runePage.secondary.includes(rune.id)} onClick={() => toggleSecondaryRune(rune.id, i+1)}/>)}</div>
            </div>)}</div>}
          </> : <p className="guide-instruction">Catalogo rune non disponibile. Puoi comunque scrivere il tuo setup nel campo di testo sotto.</p>}
          <label className="guide-field">Altre indicazioni sulle rune (opzionale)
            <textarea value={draft.runes} maxLength={400} rows={2} onChange={(e) => setDraft((old) => ({...old, runes:e.target.value}))} placeholder="Shard, situazioni particolari, varianti..." />
          </label>
        </>}
        {tab === 'items' && <>
          <div className="guide-section-head"><strong>La tua build</strong><span>{draft.itemIds.length}/6 oggetti selezionati, in ordine</span></div>
          <p className="guide-item-help">Clicca un oggetto per aggiungerlo in ordine; clicca di nuovo o premi lo slot per rimuoverlo. Massimo 6 oggetti.</p>
          <div className="guide-build-slots">{Array.from({length: 6}, (_, index) => {
            const id = draft.itemIds[index]; const item = assets.items.find((entry) => entry.id === id);
            return <button key={index} type="button" disabled={!id} className={`guide-build-slot ${id ? 'filled' : ''}`} onClick={() => id && toggleItem(id)} title={id ? `Rimuovi ${item?.name || id}` : `Slot ${index + 1}`}>
              {id ? <GuideIcon src={itemIconUrl(id, itemVersion, item?.icon)} label={item?.name || id} /> : <span>+</span>}<small>{index + 1}</small>
            </button>;
          })}</div>
          <div className="guide-item-search"><Search size={17}/><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un oggetto per nome o ID..." aria-label="Cerca un oggetto"/>
            {query && <button type="button" onClick={() => setQuery('')} title="Azzera ricerca" aria-label="Azzera ricerca"><X size={15}/></button>}
          </div>
          {assets.itemsLoading ? <p className="guide-instruction" role="status">Caricamento oggetti da Riot Data Dragon…</p> :
            assets.itemsError ? <p className="guide-instruction guide-load-error" role="alert">{assets.itemsError}</p> :
            assets.items.length ? <>
              <div className="guide-item-count">{filteredItems.length} oggetti {query ? 'trovati' : 'disponibili'} · {draft.itemIds.length}/6 selezionati</div>
              {filteredItems.length ? <div className="guide-item-grid">{filteredItems.map((item) =>
                <IconPick key={item.id} src={itemIconUrl(item.id, itemVersion, item.icon)} label={item.name}
                  detail={item.price ? `${item.price} oro` : undefined} selected={draft.itemIds.includes(item.id)}
                  disabled={draft.itemIds.length >= 6 && !draft.itemIds.includes(item.id)} onClick={() => toggleItem(item.id)}/>)}</div>
                : <p className="guide-instruction">Nessun oggetto trovato. Prova un altro nome.</p>}
            </> : <p className="guide-instruction guide-load-error" role="alert">Catalogo oggetti vuoto. Ricarica la pagina per riprovare.</p>}
          <label className="guide-field">Note sulla build (opzionale)<textarea maxLength={400} rows={2} value={draft.items} onChange={(e) => setDraft((old) => ({...old, items: e.target.value}))} placeholder="Ordine degli acquisti, alternative, build off-meta..."/></label>
        </>}
        {tab === 'notes' && <>
          <div className="guide-section-head"><strong>Consigli per {champion.name}</strong><span>Visibili agli amici che ricevono questa pool</span></div>
          <label className="guide-field">Matchup, combo, variazioni, idee off-meta<textarea maxLength={400} rows={8} value={draft.notes} onChange={(e) => setDraft((old) => ({...old, notes:e.target.value}))} placeholder="Scrivi i tuoi consigli per questo campione in questo ruolo..." /></label>
        </>}
      </div>
      <footer className="guide-footer"><button type="button" className="guide-clear" onClick={() => setDraft({runes:'', items:'', notes:'', runePage: {...EMPTY_PAGE,primary:[0,0,0,0],secondary:[]}, itemIds:[]})}><Trash2 size={15}/> Svuota guida</button>
        <span>Solo consigli personali</span><button type="button" className="guide-save" onClick={save}><Check size={16}/> Salva guida</button></footer>
    </section>
  </div>;
}
