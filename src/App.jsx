import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight,
  Copy, Crown, Crosshair, Database, Download, Heart, Info, Layers3, Pencil, Plus, RotateCcw,
  Search, Shield, Shuffle, Sparkles, Swords, Trash2, Trees, Upload, Users, X,
  GitMerge, WandSparkles, SlidersHorizontal, Link2, LogIn, LogOut, CircleCheck, CircleDashed, Wifi, Cloud, CloudUpload, CloudDownload, BookOpen, Home, Package,
} from 'lucide-react';
import {
  ACCENTS, DEFAULT_PLAYERS, FALLBACK_CHAMPIONS, ROLES, ROLE_IDS, blankPools,
  championImageUrl, countFilledRoles, countSelected, getChampById,
} from './data.js';
import { generateDraw } from './roulette.js';
import { generateRoleSelections, generateRecommendedComps, validateLobbyPools } from './recommendations.js';
import { createPoolsFile, parsePoolsFile } from './poolsFile.js';
import { PROFILE_KEY, cleanOwnProfile, cleanRoomCode, isProfileComplete, readyMembers, getRoomMembers, createSharedResult, cleanAdvice, adviceForDraw } from './roomLogic.js';
import AdviceModal from './AdviceModal.jsx';
import { normalizeRunes, normalizeItems, runeIconUrl, itemIconUrl, fetchGameAsset } from './gameAssets.js';
import { firebaseConfigured, createRoom, assertRoomExists, joinRoom, watchRoom, updateMember, leaveRoom, changeRoomSettings, submitRoll, restartRoom, closeRoom, beginRoll, markRoomActivity, watchConnection, watchAuth, connectGoogle, disconnectGoogle, isGoogleAccount, saveCloudProfile, loadCloudProfile } from './firebaseRoom.js';

const STORAGE_KEY = 'rift-roulette-state-v1';

function freshDemo() {
  const player = { id: 'user-local', name: 'user', accent: ACCENTS[0], pools: blankPools(), advice: {} };
  return { players: [player], lobbyIds: [], selectedId: player.id };
}

function untouchedOldDemo(players) {
  return players?.length === DEFAULT_PLAYERS.length && DEFAULT_PLAYERS.every((demo, index) => {
    const player = players[index];
    return player?.id === demo.id && player?.name === demo.name &&
      !Object.keys(player.advice || {}).length && ROLE_IDS.every((role) =>
        JSON.stringify(player.pools?.[role] || []) === JSON.stringify(demo.pools[role]));
  });
}

function readStoredState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || !Array.isArray(stored.players) || !stored.players.length || untouchedOldDemo(stored.players)) return freshDemo();
    const players = stored.players
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p, i) => ({
        id: p.id,
        name: p.name.slice(0, 24),
        accent: typeof p.accent === 'string' ? p.accent : ACCENTS[i % ACCENTS.length],
        advice: cleanAdvice(p.advice, p.pools || {}),
        pools: Object.fromEntries(ROLE_IDS.map((role) => [
          role,
          Array.isArray(p.pools?.[role])
            ? [...new Set(p.pools[role].filter((id) => typeof id === 'string'))]
            : [],
        ])),
      }));
    if (!players.length) return freshDemo();
    const ids = new Set(players.map((p) => p.id));
    const lobbyIds = Array.isArray(stored.lobbyIds)
      ? [...new Set(stored.lobbyIds)].filter((id) => ids.has(id)).slice(0, 5)
      : players.slice(0, 3).map((p) => p.id);
    return {
      players,
      lobbyIds,
      selectedId: ids.has(stored.selectedId) ? stored.selectedId : players[0].id,
    };
  } catch {
    return freshDemo();
  }
}

function RoleIcon({ role, size = 18 }) {
  const props = { size, strokeWidth: 1.7 };
  switch (role) {
    case 'TOP': return <Crown {...props} />;
    case 'JUNGLE': return <Trees {...props} />;
    case 'MID': return <Swords {...props} />;
    case 'ADC': return <Crosshair {...props} />;
    default: return <Shield {...props} />;
  }
}

function Avatar({ player, size = 'regular' }) {
  const name = player?.name.trim() || 'Player';
  return (
    <span className={`avatar avatar-${size}`} style={{ '--avatar-accent': player?.accent || '#69d4d1' }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ChampionPortrait({ champion, version, size = 'regular' }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [champion.id, version]);
  const fallbackVersion = '16.22.1';
  const sourceVersion = attempt === 1 ? fallbackVersion : version;

  return (
    <span className={`champ-portrait champ-portrait-${size}`}>
      {attempt < 2 ? (
        <img
          src={championImageUrl(champion, sourceVersion)}
          alt={champion.name}
          loading="lazy"
          onError={() => setAttempt((n) => n === 0 && version !== fallbackVersion ? 1 : 2)}
        />
      ) : (
        <span className="portrait-fallback">{champion.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

function useChampionCatalogue() {
  const [catalogue, setCatalogue] = useState({
    champions: FALLBACK_CHAMPIONS,
    version: '16.22.1',
    source: 'base',
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const versionRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
        signal: controller.signal,
      });
      if (!versionRes.ok) throw new Error('Versione non disponibile');
      const versions = await versionRes.json();
      if (!versions?.[0]) throw new Error('Nessuna versione disponibile');
      const version = versions[0];
      const championsRes = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/it_IT/champion.json`,
        { signal: controller.signal },
      );
      if (!championsRes.ok) throw new Error('Campioni non disponibili');
      const payload = await championsRes.json();
      const champions = Object.values(payload.data || {})
        .map((c) => ({ id: c.id, name: c.name, image: c.image?.full || `${c.id}.png` }))
        .sort((a, b) => a.name.localeCompare(b.name, 'it'));
      if (champions.length < 100) throw new Error('Catalogo incompleto');
      setCatalogue((current) => ({ ...current, champions, version, source: 'riot' }));
    }
    load().catch((error) => {
      if (error.name !== 'AbortError') {
        // La lista interna permette di usare l'app anche senza la rete Riot.
      }
    });
    return () => controller.abort();
  }, []);
  return catalogue;
}

function PanelHeading({ title, action }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PlayersPanel({ players, selectedId, onSelect, onAdd, onRemove, onExport, onImport }) {
  return (
    <aside className="panel players-panel">
      <PanelHeading
        title="Il tuo roster"
        action={<span className="count-tag">{String(players.length).padStart(2, '0')}</span>}
      />
      <div className="players-list">
        {players.map((player) => (
          <button
            type="button"
            key={player.id}
            className={`player-list-item ${selectedId === player.id ? 'selected' : ''}`}
            onClick={() => onSelect(player.id)}
            aria-pressed={selectedId === player.id}
          >
            <Avatar player={player} />
            <span className="player-list-text">
              <strong>{player.name.trim() || 'Senza nome'}</strong>
              <small>{countFilledRoles(player)}/5 ruoli · {countSelected(player)} pick</small>
            </span>
            <ChevronRight size={16} className="player-chevron" />
          </button>
        ))}
      </div>
      <button type="button" className="add-player-button" onClick={onAdd}>
        <Plus size={17} /> Aggiungi un giocatore
      </button>
      <div className="pool-file-section">
        <span className="pool-file-label"><Database size={14} /> BACKUP DELLE POOL</span>
        <div className="pool-file-actions">
          <button type="button" onClick={onExport} title="Scarica tutte le pool in un file JSON">
            <Download size={15} /> Esporta
          </button>
          <button type="button" onClick={onImport} title="Ripristina un backup JSON">
            <Upload size={15} /> Importa
          </button>
        </div>
        <p>Salva tutti i profili in un file .json e ricaricali quando vuoi.</p>
      </div>
      <div className="players-info">
        <span className="info-symbol"><Database size={16} /></span>
        <span>Le pool si salvano anche automaticamente su questo browser.</span>
      </div>
      {players.length > 1 && (
        <button type="button" className="delete-profile-button" onClick={() => onRemove(selectedId)}>
          <Trash2 size={14} /> Elimina profilo selezionato
        </button>
      )}
    </aside>
  );
}

function RoleCard({ role, player, champions, version, onAdd, onRemove, onMove, onAdvice }) {
  const ids = player.pools[role.id] || [];
  return (
    <div className={`role-card role-${role.id.toLowerCase()}`}>
      <div className="role-card-topline">
        <div className="role-icon-box"><RoleIcon role={role.id} size={19} /></div>
        <div className="role-title-wrap">
          <h3>{role.label}</h3>
          <span>{role.subtitle}</span>
        </div>
        <span className={`role-count ${ids.length > 0 ? 'role-count-complete' : ''}`}>
          {ids.length} <span>PICK</span>
        </span>
      </div>
      <div className="champion-slots">
        {ids.map((id, index) => {
          const champion = getChampById(id, champions);
          return (
            <div key={id} className="champion-slot champion-slot-filled" title={`${champion.name} — Priorità ${index + 1}`}>
              <span className="slot-rank">{String(index + 1).padStart(2, '0')}</span>
              <ChampionPortrait champion={champion} version={version} size="tile" />
              <span className="slot-name">{champion.name}</span>
              <div className="slot-actions">
                <button type="button" className={`slot-advice ${player.advice?.[role.id]?.[id] ? 'has-advice' : ''}`} onClick={() => onAdvice(role.id, id)} title="Scrivi consigli per rune e oggetti" aria-label={`Consigli personali per ${champion.name}`}><BookOpen size={14}/></button>
                <button type="button" onClick={() => onMove(role.id, index, -1)} disabled={index === 0}
                  title="Aumenta priorità" aria-label={`Aumenta priorità di ${champion.name}`}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => onMove(role.id, index, 1)} disabled={index === ids.length - 1}
                  title="Diminuisci priorità" aria-label={`Diminuisci priorità di ${champion.name}`}>
                  <ChevronRight size={14} />
                </button>
                <button type="button" className="slot-remove" onClick={() => onRemove(role.id, id)}
                  disabled={ids.length === 1} title={ids.length === 1 ? 'È richiesto almeno un campione' : 'Rimuovi'} aria-label={`Rimuovi ${champion.name}`}>
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className="champion-slot champion-slot-empty" onClick={() => onAdd(role.id)}
          aria-label={`Aggiungi campione a ${role.label}`}>
          <span className="empty-add-icon"><Plus size={19} strokeWidth={1.7} /></span>
          <span className="empty-copy">{ids.length ? 'Aggiungi campione' : 'Almeno 1 campione'}</span>
        </button>
      </div>
    </div>
  );
}

function EditorPanel({ player, champions, version, onRename, onOpenPicker, onRemove, onMove, onAdvice }) {
  const completedRoles = countFilledRoles(player);
  return (
    <section className="panel editor-panel">
      <PanelHeading
        title="Champion pool"
        action={<span className="editor-status"><span className="live-dot" /> EDITABILE</span>}
      />
      <div className="editor-profile">
        <Avatar player={player} size="large" />
        <div className="editor-profile-body">
          <label htmlFor="player-name">STAI MODIFICANDO I SET DI</label>
          <div className="name-edit">
            <input id="player-name" type="text" aria-label="Nome del giocatore"
              value={player.name} maxLength={24}
              onChange={(e) => onRename(player.id, e.target.value)}
              spellCheck="false" />
            <Pencil size={15} />
          </div>
        </div>
        <div className="pool-progress">
          <strong>{completedRoles}<span>/5</span></strong>
          <small>ruoli pronti</small>
        </div>
      </div>
      <div className="editor-helper">
        <Info size={14} /> Almeno 1 campione per ruolo, senza limite massimo. Le priorità influenzano la probabilità di estrazione.
      </div>
      <div className="role-cards">
        {ROLES.map((role) => (
          <RoleCard key={`${player.id}-${role.id}`} role={role} player={player}
            champions={champions} version={version} onAdd={onOpenPicker}
            onRemove={onRemove} onMove={onMove} onAdvice={onAdvice} />
        ))}
      </div>
    </section>
  );
}

function useGameAssets(version) {
  const [assets, setAssets] = useState({ runes: [], items: [], itemsLoading: true, itemsError: "", itemVersion: version });
  useEffect(() => {
    const controller = new AbortController();
    setAssets((previous) => ({ ...previous, itemsLoading: true, itemsError: '' }));
    async function load() {
      const [runes, items] = await Promise.allSettled([
        fetchGameAsset(version, 'runesReforged', controller.signal),
        fetchGameAsset(version, 'item', controller.signal),
      ]);
      if (!controller.signal.aborted) setAssets({
        runes: runes.status === 'fulfilled' ? normalizeRunes(runes.value.data) : [],
        items: items.status === 'fulfilled' ? normalizeItems(items.value.data) : [],
        itemVersion: version,
        itemsLoading: false,
        itemsError: items.status === 'rejected' ? 'Impossibile caricare gli oggetti da Riot Data Dragon. Controlla la connessione e ricarica la pagina.' : '',
      });
    }
    load().catch(() => {});
    return () => controller.abort();
  }, [version]);
  return assets;
}

function PersonalAdvice({ guide, author, assets, version }) {
  if (!guide || !Object.values(guide).some(Boolean)) return null;
  const page = guide.runePage;
  const runeData = assets?.runes || [];
  const allRunes = runeData.flatMap((tree) => tree.slots.flat());
  const runeIds = [...(page?.primary || []), ...(page?.secondary || [])].filter(Boolean);
  return <details className="personal-advice">
    <summary><BookOpen size={14}/> Guida di {author || 'un amico'}</summary>
    {runeIds.length > 0 && <div className="advice-visual-strip">
      {runeIds.map((id) => { const rune = allRunes.find((r) => r.id === id); return rune && <img title={rune.name} alt={rune.name} key={id} src={runeIconUrl(rune.icon)} />; })}
    </div>}
    {Array.isArray(guide.itemIds) && guide.itemIds.length > 0 && <div className="advice-visual-strip">
      {guide.itemIds.map((id) => <img key={id} src={itemIconUrl(id, assets?.itemVersion || version, assets?.items?.find((it) => it.id === id)?.icon)} title={assets?.items?.find((it) => it.id === id)?.name || id} alt={assets?.items?.find((it) => it.id === id)?.name || id} />)}
    </div>}
    {guide.runes && <p><strong>Rune:</strong> {guide.runes}</p>}
    {guide.items && <p><strong>Build:</strong> {guide.items}</p>}
    {guide.notes && <p><strong>Note:</strong> {guide.notes}</p>}
  </details>;
}

function ModePicker({ mode, tone, onMode, onTone, disabled }) {
  return (
    <div className="mode-picker" aria-label="Modalità di sorteggio">
      <span className="mode-caption"><GitMerge size={14} /> SCEGLI IL TIPO DI ROLL</span>
      <div className="mode-options">
        <button className={`mode-option ${mode === 'classic' ? 'active' : ''}`}
          type="button" disabled={disabled} aria-pressed={mode === 'classic'} onClick={() => onMode('classic')}>
          <Shuffle size={19} />
          <strong>Pool classica</strong>
          <small>Solo i set degli amici. Ruoli e pool incrociati.</small>
        </button>
        <button className={`mode-option ${mode === 'creative' ? 'active' : ''}`}
          type="button" disabled={disabled} aria-pressed={mode === 'creative'} onClick={() => onMode('creative')}>
          <WandSparkles size={19} />
          <strong>Teamcomp creativa</strong>
          <small>Teamcomp sinergiche con possibili pick extra.</small>
        </button>
      </div>
      {mode === 'creative' && (
        <div className="tone-control">
          <div className="tone-head"><SlidersHorizontal size={14} /><span>LIBERTÀ CREATIVA</span></div>
          <div className="tone-buttons" role="group" aria-label="Libertà creativa">
            {[
              { id: 'faithful', label: 'Fedele' },
              { id: 'balanced', label: 'Mix' },
              { id: 'offmeta', label: 'Off-meta' },
            ].map((option) => (
              <button key={option.id} type="button" disabled={disabled} aria-pressed={tone === option.id}
                className={tone === option.id ? 'active' : ''} onClick={() => onTone(option.id)}>{option.label}</button>
            ))}
          </div>
          <p>{tone === 'faithful' ? 'Preferisce le pool, con alternative soltanto se migliorano molto il risultato.' : tone === 'offmeta' ? 'Dà spazio anche a pick fuori ruolo: idee sperimentali, non necessariamente competitive.' : 'Mescola campioni delle pool con alternative simili e sinergiche.'}</p>
        </div>
      )}
    </div>
  );
}

function LobbyPanel({ players, lobbyIds, draw, onToggle, onShuffle, rolling, mode, tone, onMode, onTone }) {
  const selected = lobbyIds.length;
  const hasEnough = selected >= 2;
  return (
    <aside className="panel lobby-panel">
      <PanelHeading
        title="La tua lobby"
        action={<span className="count-tag"><Users size={13} /> {selected}/5</span>}
      />
      <ModePicker mode={mode} tone={tone} onMode={onMode} onTone={onTone} disabled={rolling} />
      <p className="lobby-description">Chi entra nella prossima queue?</p>
      <div className="lobby-players">
        {players.map((player) => {
          const active = lobbyIds.includes(player.id);
          return (
            <button type="button" key={player.id}
              className={`lobby-player ${active ? 'is-active' : ''}`}
              aria-pressed={active} onClick={() => onToggle(player.id)} disabled={rolling}>
              <span className={`lobby-checkbox ${active ? 'checked' : ''}`}>
                {active && <Check size={13} strokeWidth={3} />}
              </span>
              <Avatar player={player} size="small" />
              <span className="lobby-player-name">{player.name.trim() || 'Senza nome'}</span>
              <span className="lobby-player-state">{active ? 'IN' : 'OUT'}</span>
            </button>
          );
        })}
      </div>
      <div className="lobby-rule">
        <div className="rule-mark"><Shuffle size={18} /></div>
        <div>
          <strong>L’intreccio</strong>
          <p>Due ruoli diversi a testa, senza coppie duplicate (anche invertite). Ognuno riceve i set di un altro membro: {mode === 'classic' ? 'nessun pick fuori pool.' : 'la squadra può proporre alternative e combo.'}</p>
        </div>
      </div>
      <button type="button" className="shuffle-button" onClick={onShuffle} disabled={!hasEnough || rolling}>
        {rolling ? <Shuffle size={20} className="shuffle-spinning" /> : draw ? <RotateCcw size={20} /> : <Shuffle size={20} />}
        <span>{rolling ? 'SORTEGGIO IN CORSO...' : draw ? 'RANDOMIZZA ANCORA' : mode === 'creative' ? 'GENERA LA TEAMCOMP' : 'RANDOMIZZA LA LOBBY'}</span>
        <ArrowRight size={19} />
      </button>
      <p className="shuffle-hint">
        {hasEnough ? `${selected} giocatori selezionati · max 5` : 'Seleziona almeno 2 giocatori'}
      </p>
      {draw && (
        <div className="lobby-exchanges">
          <div className="exchanges-heading"><Sparkles size={14} /> SCAMBIO DEI SET</div>
          {draw.map((row) => {
            const player = players.find((p) => p.id === row.playerId);
            const donor = players.find((p) => p.id === row.donorId);
            return player && donor && (
              <div className="exchange-line" key={row.playerId}>
                <span>{player.name.trim() || 'Player'}</span>
                <ArrowLeft size={14} />
                <strong>{donor.name.trim() || 'Player'}</strong>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function ResultRole({ roleId, selected, champions, version, label, advice, author, assets, showAdvice = true }) {
  const role = ROLES.find((r) => r.id === roleId);
  return (
    <div className={`result-role role-${roleId.toLowerCase()}`}>
      <div className="result-role-header">
        <div className="result-role-icon"><RoleIcon role={roleId} size={18} /></div>
        <strong>{role.label}</strong>
        <span>{label} · {selected.length}/3 ESTRATTI</span>
      </div>
      <div className="result-champions">
        {selected.map((id, index) => {
          const champion = getChampById(id, champions);
          return (
            <div className={`result-champion ${index === 0 ? 'result-main-pick' : ''}`} key={id}>
              <span className="result-champ-rank">{index === 0 ? <Crown size={14}/> : String(index + 1).padStart(2, '0')}</span>
              <ChampionPortrait champion={champion} version={version} size="result" />
              <span className="result-champ-name">{champion.name}</span>
              {index === 0 && <span className="main-pick-label">PRINCIPALE</span>}
              {showAdvice && <PersonalAdvice guide={advice?.[id]} author={author} assets={assets} version={version}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendedComps({ comps, players, champions, version, mode, advice, donors, assets, showAdvice = true }) {
  return (
    <section className="recommendations-section" aria-label="Composizioni consigliate">
      <div className="recommendations-header">
        <span className="section-eyebrow"><Sparkles size={15} /> COMPOSIZIONI CONSIGLIATE</span>
        <h3>Provate una di queste.</h3>
        <p>{mode === 'classic' ? 'Combinazioni dei campioni appena estratti, senza pick esterni.' : 'Sinergie tra i campioni estratti, con possibili alternative dalla pool completa o pick extra.'} Le sinergie sono indicazioni generali, non dati della patch.</p>
      </div>
      <div className="recommendations-grid">
        {!comps.length && <div className="recommendation-unavailable">Con queste pool non è possibile creare una composizione senza campioni duplicati. Aggiungi altri champion ai ruoli coinvolti e rilancia.</div>}
        {comps.map((comp, index) => (
          <article key={comp.id} className="recommendation-card" style={{ '--reveal-order': index }}>
            <div className="recommendation-top">
              <span className="recommendation-number">0{comp.id}</span>
              <span className="recommendation-label">{comp.label}</span>
            </div>
            <h4>{comp.style.label}</h4>
            <p className="recommendation-description">{comp.style.description}</p>
            <div className="recommendation-lineup">
              {ROLES.map((role) => {
                const pick = comp.picks.find((p) => p.primary === role.id);
                const player = players.find((p) => p.id === pick?.playerId);
                const champion = pick && getChampById(pick.id, champions);
                return (
                  <div key={role.id} className={`recommendation-pick ${!pick ? 'is-unfilled' : ''}`}>
                    <span className="recommendation-role"><RoleIcon role={role.id} size={14} /></span>
                    {pick ? <>
                      <ChampionPortrait champion={champion} version={version} size="result" />
                      <span className="recommendation-pick-copy"><strong>{champion.name}</strong><small>{player?.name} · {pick.reason}</small></span>
                      {!pick.isPool && <span className="extra-champ-badge">EXTRA</span>}
                      {showAdvice && <PersonalAdvice guide={advice?.[pick.playerId]?.[pick.primary]?.[pick.id]} author={donors?.[pick.playerId]} assets={assets} version={version}/> }
                    </> : <span className="recommendation-pick-copy"><strong>Posto libero</strong><small>Ruolo non assegnato</small></span>}
                  </div>
                );
              })}
            </div>
            {comp.partial && <p className="recommendation-note">Composizione parziale: per tutti e 5 i ruoli servono 5 giocatori.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function Results({ draw, players, champions, version, onShuffle, onCopy, drawRevision, mode, selections, recommendations, advice, assets, showAdvice = true, allowReroll = true }) {
  return (
    <section className="results-section" id="risultati">
      <div className="results-header">
        <div>
          <span className="section-eyebrow">04 <span>/</span> IL VERDETTO</span>
          <h2>{draw ? mode === 'creative' ? 'La vostra teamcomp.' : 'La queue è servita.' : 'Il verdetto della Rift.'}</h2>
          <p>{draw ? mode === 'creative' ? 'Fino a 3 campioni dalla pool per ruolo, con formazioni consigliate e possibili pick extra.' : 'Fino a 3 campioni casuali per ruolo, con un principale e le comp suggerite.' : 'Completa i set, scegli la lobby e lascia decidere alla sorte.'}</p>
        </div>
        {draw && (
          <div className="results-actions">
            <button type="button" className="secondary-action" onClick={onCopy}><Copy size={16} /> Copia risultato</button>
            {allowReroll && <button type="button" className="secondary-action accent-action" onClick={onShuffle}><RotateCcw size={16} /> Nuovo round</button>}
          </div>
        )}
      </div>
      {!draw ? (
        <div className="empty-results">
          <div className="empty-art"><Shuffle size={43} strokeWidth={1.25} /><span className="empty-art-dot dot-one" /><span className="empty-art-dot dot-two" /><span className="empty-art-dot dot-three" /></div>
          <h3>Nessun sorteggio, per ora.</h3>
          <p>Scegli la modalità nella lobby e premi <strong>{mode === 'creative' ? 'Genera la teamcomp' : 'Randomizza la lobby'}</strong>.</p>
        </div>
      ) : (
        <>
        <div className="result-grid" key={drawRevision}>
          {draw.map((item, index) => {
            const player = players.find((p) => p.id === item.playerId);
            const donor = players.find((p) => p.id === item.donorId);
            if (!player || !donor) return null;
            return (
              <article className="result-card" key={item.playerId} style={{ '--result-accent': player.accent, '--reveal-order': index }}>
                <div className="result-card-accent" />
                <div className="result-card-header">
                  <Avatar player={player} size="large" />
                  <div className="result-player-details">
                    <span>PLAYER {String(index + 1).padStart(2, '0')}</span>
                    <h3>{player.name.trim() || 'Player'}</h3>
                  </div>
                  <CheckCheck className="result-check" size={19} />
                </div>
                <div className="result-donor">
                  <span className="donor-mini-icon"><ArrowDownRight size={20} /></span>
                  <div><small>GIOCA CON I SET DI</small><strong>{donor.name.trim() || 'Player'}</strong></div>
                  <Avatar player={donor} size="small" />
                </div>
                <div className="result-roles">
                  <ResultRole roleId={item.primary} selected={selections[item.playerId]?.primary || []} champions={champions} version={version} label="PRIMARIO" advice={advice?.[item.playerId]?.[item.primary]} author={donor.name} assets={assets} showAdvice={showAdvice}/>
                  <ResultRole roleId={item.secondary} selected={selections[item.playerId]?.secondary || []} champions={champions} version={version} label="SECONDARIO" advice={advice?.[item.playerId]?.[item.secondary]} author={donor.name} assets={assets} showAdvice={showAdvice}/>
                </div>
              </article>
            );
          })}
        </div>
        <RecommendedComps comps={recommendations || []} players={players} champions={champions} version={version} mode={mode} advice={advice} assets={assets} showAdvice={showAdvice} donors={Object.fromEntries(draw.map((entry) => [entry.playerId, players.find((p) => p.id === entry.donorId)?.name || 'un amico']))}/>
        </>
      )}
    </section>
  );
}

function RollOverlay({ frame, mode }) {
  return (
    <div className="roll-backdrop" role="status" aria-live="polite" aria-label="Sorteggio della lobby in corso">
      <div className="roll-dialog">
        <span className="roll-eyebrow"><Sparkles size={14} /> RIFT ROULETTE · ROLL IN CORSO</span>
        <div className="roll-emblem" aria-hidden="true">
          <span className="roll-ring roll-ring-one" />
          <span className="roll-ring roll-ring-two" />
          <span className="roll-emblem-center"><Shuffle size={31} /></span>
        </div>
        <h2>{mode === 'creative' ? 'Creando la teamcomp' : 'Mescolando la lobby'}</h2>
        <p>{mode === 'creative' ? 'Studiando le sinergie e scegliendo i campioni...' : 'Assegnazione dei ruoli e scambio delle pool...'}</p>
        <div className="roll-slots" aria-hidden="true">
          <div className="roll-slot">
            <small>GIOCATORE</small>
            <strong key={frame?.player}>{frame?.player || '???'}</strong>
          </div>
          <div className="roll-slot-role" key={`${frame?.role}-${frame?.player}`}>
            <small>RUOLO</small>
            <strong>{frame?.role || '???'}</strong>
          </div>
          <div className="roll-slot">
            <small>POOL DI</small>
            <strong key={frame?.donor}>{frame?.donor || '???'}</strong>
          </div>
        </div>
        <div className="roll-progress"><span /></div>
      </div>
    </div>
  );
}

function ChampionPicker({ roleId, player, champions, version, onToggle, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const role = ROLES.find((r) => r.id === roleId);
  const chosen = player.pools[roleId] || [];
  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return champions.filter((c) => c.name.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalized)
      || c.id.toLowerCase().includes(normalized));
  }, [query, champions]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="champion-modal" role="dialog" aria-modal="true" aria-label={`Seleziona campioni per ${role.label}`}>
        <div className="modal-header">
          <div className={`modal-role-icon role-${roleId.toLowerCase()}`}><RoleIcon role={roleId} size={22} /></div>
          <div className="modal-header-text"><span>CHAMPION SELECT</span><h2>{role.label} <small>· {player.name}</small></h2></div>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Chiudi"><X size={21} /></button>
        </div>
        <div className="modal-selected">
          <span className="modal-small-label">LA TUA POOL IN ORDINE DI PRIORITÀ <strong>{chosen.length} CAMPIONI · MIN 1</strong></span>
          <div className="modal-selected-list">
            {chosen.map((id, index) => {
              const champion = getChampById(id, champions);
              return (
                <div className="modal-chosen has-champion" key={id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <ChampionPortrait champion={champion} version={version} size="mini" />
                  <strong>{champion.name}</strong>
                </div>
              );
            })}
            {!chosen.length && <p className="modal-empty-pool">Seleziona almeno un campione per questo ruolo.</p>}
          </div>
        </div>
        <div className="champion-search-wrap">
          <Search size={19} />
          <input ref={inputRef} aria-label="Cerca un campione" type="search" value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un campione..." />
          <span>{filtered.length} trovati</span>
        </div>
        <div className="champion-grid-scroll">
          {filtered.length ? <div className="champion-grid">
            {filtered.map((champion) => {
              const pickIndex = chosen.indexOf(champion.id);
              const isChosen = pickIndex !== -1;
              return (
                <button key={champion.id} type="button"
                  className={`picker-champion ${isChosen ? 'is-picked' : ''}`}
                  onClick={() => onToggle(roleId, champion.id)}
                  disabled={isChosen && chosen.length === 1}
                  aria-pressed={isChosen}>
                  <ChampionPortrait champion={champion} version={version} size="picker" />
                  <span className="picker-name">{champion.name}</span>
                  {isChosen && <span className="picker-check"><Check size={12} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div> : <div className="picker-empty">Nessun campione trovato per “{query}”.</div>}
        </div>
        <div className="modal-footer">
          <span><Info size={15} /> Puoi scegliere tutti i campioni che vuoi; almeno uno deve rimanere.</span>
          <button type="button" className="modal-done" onClick={onClose}><Check size={16} /> Fatto</button>
        </div>
      </div>
    </div>
  );
}

function AddPlayerModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="add-modal" role="dialog" aria-modal="true" aria-label="Nuovo giocatore"
        onSubmit={(e) => { e.preventDefault(); onAdd(name); }}>
        <button type="button" className="icon-button add-close" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        <div className="new-player-symbol"><Users size={28} /></div>
        <span className="section-eyebrow">NUOVO MEMBRO</span>
        <h2>Un altro nel party.</h2>
        <p>Crea un profilo con una champion pool personalizzata per ciascun ruolo.</p>
        <label htmlFor="new-player-name">NOME GIOCATORE</label>
        <input id="new-player-name" ref={inputRef} value={name} maxLength={24}
          onChange={(e) => setName(e.target.value)} placeholder="Nome del giocatore..." />
        <button className="add-confirm" type="submit" disabled={!name.trim()}><Plus size={18} /> Crea profilo</button>
      </form>
    </div>
  );
}

function getOwnProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (stored) {
      const oldDefault = stored.name === 'Giocatore' && !countSelected({ pools: stored.pools || blankPools() });
      return cleanOwnProfile(oldDefault ? { ...stored, name: 'user' } : stored);
    }
    // I vecchi profili dimostrativi non vengono mai importati nel party online.
  } catch { /* Browser senza localStorage: profilo temporaneo. */ }
  return cleanOwnProfile({ name: 'user', pools: blankPools() });
}

function OnlineParty({ champions, version, assets, homeNonce, localRequest, onGoLocal }) {
  const [profile, setProfile] = useState(getOwnProfile);
  const [account, setAccount] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudAutosave, setCloudAutosave] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [adviceTarget, setAdviceTarget] = useState(null);
  const [codeInput, setCodeInput] = useState(() => cleanRoomCode(new URLSearchParams(window.location.search).get('room')));
  const [roomCode, setRoomCode] = useState('');
  const [uid, setUid] = useState('');
  const [room, setRoom] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [pickerRole, setPickerRole] = useState(null);
  const [drawRevision, setDrawRevision] = useState(0);
  const [rollFrame, setRollFrame] = useState(null);
  const importProfileRef = useRef(null);
  const attemptRef = useRef(false);
  const rollBusyRef = useRef(false);
  const profileRef = useRef(profile);
  const roomRef = useRef(room);
  const codeRef = useRef(roomCode);
  const membershipRef = useRef({ roomCode: '', uid: '' });
  membershipRef.current = { roomCode, uid };
  profileRef.current = profile;
  roomRef.current = room;
  codeRef.current = roomCode;

  const members = useMemo(() => getRoomMembers(room).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)), [room]);
  const meta = room?.meta;
  const isHost = Boolean(uid && meta?.hostUid === uid);
  const me = room?.members?.[uid];
  const isReady = Boolean(meta?.phase === 'waiting' && me?.readyRound === meta.round);
  const profileComplete = isProfileComplete(profile);
  const isBusy = working || meta?.phase === 'rolling';
  const roomPlayers = useMemo(() => members.map((m) => ({ ...cleanOwnProfile(m), id: m.id })), [members]);
  const resultPlayers = room?.result?.players || roomPlayers;

  const localMountedRef = useRef(localRequest);
  useEffect(() => {
    if (localMountedRef.current === localRequest) return;
    localMountedRef.current = localRequest;
    (async () => {
      if (roomCode) {
        const confirmation = window.confirm(isHost
          ? 'Passare alla modalità locale? Chiuderai la stanza multiplayer per tutti.'
          : 'Passare alla modalità locale e uscire dalla stanza?');
        if (!confirmation) return;
        const success = await leave(isHost);
        if (!success) return;
      }
      onGoLocal();
    })();
  }, [localRequest]);

  const homeMountedRef = useRef(homeNonce);
  useEffect(() => {
    if (homeMountedRef.current === homeNonce) return;
    homeMountedRef.current = homeNonce;
    if (roomCode) {
      if (isHost && !window.confirm('Tornare alla home e chiudere la stanza per tutti?')) return;
      leave(isHost);
    } else {
      setCodeInput('');
      const url = new URL(window.location.href); url.searchParams.delete('room');
      window.history.replaceState(null, '', url);
    }
  }, [homeNonce]);

  useEffect(() => () => {
    const current = membershipRef.current;
    if (current.roomCode && current.uid) {
      leaveRoom(current.roomCode, current.uid).catch(() => {});
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState(null, '', url);
    }
  }, []);
  useEffect(() => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* fallback */ } }, [profile]);
  // Modificare il proprio profilo e' una interazione: non far scadere una stanza
  // mentre qualcuno prepara le pool (debounce per limitare le scritture).
  useEffect(() => {
    if (!roomCode || !uid) return undefined;
    const id = setTimeout(() => markRoomActivity(roomCode).catch(() => {}), 1200);
    return () => clearTimeout(id);
  }, [profile, roomCode, uid]);
  useEffect(() => watchAuth((next) => setAccount(next)), []);
  const googleAccount = isGoogleAccount(account);
  useEffect(() => { setCloudAutosave(false); setCloudStatus(''); }, [account?.uid]);
  useEffect(() => {
    if (!cloudAutosave || !googleAccount) return undefined;
    const timeout = setTimeout(() => {
      saveCloudProfile(profile).then(() => setCloudStatus('Sincronizzato con Google')).catch((e) => { setCloudStatus('Errore di sincronizzazione'); setMessage(`Cloud: ${e.message}`); });
    }, 1200);
    return () => clearTimeout(timeout);
  }, [profile, cloudAutosave, googleAccount, account?.uid]);

  async function googleLogin() {
    if (roomCode) { setMessage('Esci dalla stanza prima di cambiare account.'); return; }
    setCloudBusy(true);
    try { await connectGoogle(); setMessage('Account Google connesso. Scegli se caricare il cloud o salvare il profilo locale.'); }
    catch (e) { setMessage(`Accesso Google: ${e.message}`); }
    finally { setCloudBusy(false); }
  }
  async function googleLogout() {
    if (roomCode) { setMessage('Esci dalla stanza prima di cambiare account.'); return; }
    setCloudBusy(true);
    try { await disconnectGoogle(); setMessage('Scollegato da Google. Il profilo locale resta disponibile.'); }
    catch (e) { setMessage(`Disconnessione Google: ${e.message}`); }
    finally { setCloudBusy(false); }
  }
  async function pushCloud() {
    if (!googleAccount) return;
    if (!window.confirm('Salvare questo profilo su Google? Il backup cloud precedente sarà sostituito.')) return;
    setCloudBusy(true);
    try { await saveCloudProfile(profile); setCloudAutosave(true); setCloudStatus('Sincronizzato con Google'); setMessage('Profilo caricato nel cloud. Le modifiche successive si sincronizzeranno automaticamente.'); }
    catch (e) { setMessage(`Salvataggio cloud: ${e.message}`); }
    finally { setCloudBusy(false); }
  }
  async function pullCloud() {
    if (!googleAccount || isReady) return;
    setCloudBusy(true);
    try {
      const remote = await loadCloudProfile();
      if (!remote) { setMessage('Nessun profilo salvato su questo account Google.'); return; }
      if (!window.confirm('Caricare il profilo da Google? Il profilo locale sarà sostituito: esporta prima il JSON se vuoi conservarlo.')) return;
      setCloudAutosave(false); setProfile(remote);
      setCloudAutosave(true); setCloudStatus('Profilo Google caricato');
      setMessage('Profilo Google caricato. Le modifiche si sincronizzeranno automaticamente.');
    } catch (e) { setMessage(`Caricamento cloud: ${e.message}`); }
    finally { setCloudBusy(false); }
  }
  useEffect(() => {
    if (roomCode) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      window.history.replaceState(null, '', url);
      return;
    }
    // Keep invitation URLs intact until the user explicitly leaves.
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    const unsubscribe = watchRoom(roomCode, (nextRoom) => {
      if (!nextRoom || nextRoom.meta?.phase === 'closed') {
        setRoom(null);
        setRoomCode('');
        setUid('');
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url);
        setMessage('La stanza è stata chiusa oppure eliminata per inattività. Crea una nuova stanza per continuare.');
        return;
      }
      setRoom(nextRoom);
      if (nextRoom?.result?.createdAt) setDrawRevision(nextRoom.result.createdAt);
    }, (error) => setMessage(`Connessione stanza: ${error.message}`));
    return unsubscribe;
  }, [roomCode]);

  async function enterRoom(code, creating = false) {
    setWorking(true);
    setMessage('');
    try {
      if (!profileRef.current.name.trim()) throw new Error('Inserisci un nome prima di entrare in stanza.');
      const target = creating ? await createRoom() : await assertRoomExists(code);
      await joinRoom(target.code, target.uid, profileRef.current, target.meta?.round ?? 1);
      setUid(target.uid);
      setRoomCode(target.code);
      setCodeInput(target.code);
    } catch (error) {
      setMessage(error?.message || 'Impossibile entrare nella stanza.');
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    const urlCode = cleanRoomCode(new URLSearchParams(window.location.search).get('room'));
    if (!urlCode || attemptRef.current || !firebaseConfigured) return;
    attemptRef.current = true;
    // A personal profile is loaded locally; room joining never overwrites it.
    enterRoom(urlCode);
  }, []);

  // Presence is removed on disconnect; return the same player to the room on reconnect.
  useEffect(() => {
    if (!roomCode || !uid) return undefined;
    let wasDisconnected = false;
    const unsubscribe = watchConnection((connected) => {
      if (!connected) { wasDisconnected = true; return; }
      if (!wasDisconnected) return;
      wasDisconnected = false;
      joinRoom(roomCode, uid, profileRef.current, roomRef.current?.meta?.round || 1)
        .catch((error) => setMessage(`Riconnessione: ${error.message}`));
    });
    return unsubscribe;
  }, [roomCode, uid]);

  // The host starts the animation once ALL online players are ready. Atomic phase transition
  // prevents multiple open host tabs from generating two simultaneous results.
  useEffect(() => {
    if (!roomCode || !isHost || !room || rollBusyRef.current) return;
    const eligible = readyMembers(room);
    if (eligible.length < 2) return;
    rollBusyRef.current = true;
    (async () => {
      try {
        const result = createSharedResult(eligible, meta.mode, meta.tone);
        if (!await beginRoll(roomCode)) return;
        await new Promise((resolve) => setTimeout(resolve, 1700));
        if (codeRef.current !== roomCode) return;
        await submitRoll(roomCode, result, meta.round);
      } catch (error) {
        setMessage(`Sorteggio: ${error.message}. L'host può ripristinare l'attesa.`);
      } finally { rollBusyRef.current = false; }
    })();
  }, [roomCode, room, isHost, meta?.mode, meta?.tone, meta?.round]);

  useEffect(() => {
    if (meta?.phase !== 'rolling' || !members.length) return undefined;
    const tick = () => {
      const player = members[Math.floor(Math.random() * members.length)];
      const donor = members[Math.floor(Math.random() * members.length)];
      const role = ROLES[Math.floor(Math.random() * ROLES.length)];
      setRollFrame({ player: player?.name || '?', donor: donor?.name || '?', role: role.id });
    };
    tick();
    const id = setInterval(tick, 115);
    return () => clearInterval(id);
  }, [meta?.phase, members.length]);

  function changeProfile(update) {
    if (isReady || meta?.phase === 'rolling') return;
    setProfile((previous) => cleanOwnProfile(update(previous)));
  }

  function updatePool(role, updater) {
    changeProfile((previous) => ({ ...previous, pools: {
      ...previous.pools, [role]: updater(previous.pools[role] || []),
    } }));
  }

  function toggleChamp(role, id) {
    updatePool(role, (ids) => ids.includes(id) ? ids.length > 1 ? ids.filter((current) => current !== id) : ids : [...ids, id]);
  }

  function updateAdvice(role, championId, draft) {
    changeProfile((previous) => ({
      ...previous, advice: { ...previous.advice, [role]: { ...previous.advice?.[role], [championId]: draft } },
    }));
  }

  function moveChamp(role, index, direction) {
    updatePool(role, (ids) => {
      const next = [...ids];
      const target = index + direction;
      if (target < 0 || target >= next.length) return ids;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function toggleReady() {
    if (!meta || !me || meta.phase !== 'waiting' || working) return;
    if (!isReady && !profileComplete) { setMessage('Completa prima almeno un campione per ciascuno dei cinque ruoli.'); return; }
    if (!profile.name.trim()) { setMessage('Inserisci il nome del tuo giocatore.'); return; }
    setWorking(true);
    try { await updateMember(roomCode, uid, profile, isReady ? 0 : meta.round); }
    catch (error) { setMessage(error?.message || 'Impossibile aggiornare lo stato pronto.'); }
    finally { setWorking(false); }
  }

  async function leave(forceClose = false) {
    if (!roomCode) return;
    setWorking(true);
    try {
      if (forceClose) await closeRoom(roomCode);
      await leaveRoom(roomCode, uid);
      setRoomCode('');
      const url = new URL(window.location.href); url.searchParams.delete('room');
      window.history.replaceState(null, '', url);
      setRoom(null);
      setUid('');
      setMessage(forceClose ? 'Stanza chiusa.' : 'Hai lasciato la stanza.');
      return true;
    } catch (error) { setMessage(`Uscita dalla stanza: ${error.message}`); return false; }
    finally { setWorking(false); }
  }

  async function setSettings(values) {
    if (!isHost || meta?.phase !== 'waiting') return;
    try { await changeRoomSettings(roomCode, values); }
    catch (error) { setMessage(`Impostazioni: ${error.message}`); }
  }

  async function newRound() {
    if (!isHost || working) return;
    setWorking(true);
    try { await restartRoom(roomCode, meta.round); }
    catch (error) { setMessage(`Nuovo round: ${error.message}`); }
    finally { setWorking(false); }
  }

  async function recoverRoll() {
    if (!isHost || working) return;
    try { await changeRoomSettings(roomCode, { phase: 'waiting' }); }
    catch (error) { setMessage(`Ripristino: ${error.message}`); }
  }

  async function copyInvite() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    try { await navigator.clipboard.writeText(url.toString()); setMessage('Link della stanza copiato.'); }
    catch { setMessage(`Condividi il codice ${roomCode}.`); }
  }

  async function copyOnlineResults() {
    if (!room?.result) return;
    const lines = [`RIFT ROULETTE · STANZA ${roomCode} · ROUND ${meta.round}`, ''];
    for (const row of room.result.draw || []) {
      const player = resultPlayers.find((p) => p.id === row.playerId);
      const donor = resultPlayers.find((p) => p.id === row.donorId);
      lines.push(`${player?.name || '?'} · ${row.primary} + ${row.secondary} · pool di ${donor?.name || '?'}`);
      for (const kind of ['primary', 'secondary']) {
        lines.push(`  ${row[kind]}: ${(room.result.selections?.[row.playerId]?.[kind] || []).map((id) => getChampById(id, champions).name).join(' / ')}`);
      }
    }
    for (const comp of room.result.recommendations || []) {
      lines.push('', `${comp.label}: ${comp.style.label}`);
      for (const pick of comp.picks || []) lines.push(`  ${pick.primary}: ${getChampById(pick.id, champions).name}`);
    }
    try { await navigator.clipboard.writeText(lines.join('\n')); setMessage('Risultato copiato.'); }
    catch { setMessage('Impossibile copiare dal browser.'); }
  }

  function exportOwnProfile() {
    const contents = JSON.stringify({ format: 'rift-roulette-own-profile', version: 1, profile }, null, 2);
    const blob = new Blob([contents], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `rift-profile-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importOwnProfile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) { setMessage('File troppo grande.'); return; }
    try {
      const raw = await file.text();
      const decoded = JSON.parse(raw);
      let next = decoded?.format === 'rift-roulette-own-profile' ? decoded.profile : null;
      if (!next) {
        const backup = parsePoolsFile(raw);
        next = backup.players.find((p) => p.id === backup.selectedId) || backup.players[0];
      }
      if (!next || !next.pools) throw new Error('Profilo non valido.');
      if (isReady) throw new Error('Annulla prima lo stato pronto.');
      setProfile(cleanOwnProfile(next));
      setMessage('Profilo importato localmente, inclusi i consigli. Premi Pronto per condividerlo con la stanza.');
    } catch (error) { setMessage(`Importazione: ${error.message}`); }
  }

  return (
    <div className="online-page">
      <div className="online-intro">
        <div className="online-intro-copy"><span className="section-eyebrow"><Wifi size={15}/> PARTY MULTIPLAYER</span>
        <p>Condividi il codice, prepara le pool e premi Pronto. Da 2 a 5 amici, sincronizzati.</p></div>
        <div className="intro-champ-strip" aria-label="Quattro campioni di League of Legends">
          <div className="intro-champ-portraits">
            {['Ahri', 'Jinx', 'Yasuo', 'Thresh'].map((id) => <ChampionPortrait key={id} champion={getChampById(id, champions)} version={version} size="intro" />)}
          </div>
          <div className="intro-champ-meta"><strong>2–5 giocatori</strong><span>Google facoltativo</span></div>
        </div>
      </div>
      {!firebaseConfigured && <div className="online-config-notice"><Info size={20}/><div><strong>Configurazione Firebase richiesta</strong><p>La modalità multiplayer funziona dopo aver aggiunto le variabili Firebase e pubblicato le regole del database. La modalità locale resta disponibile. Segui il README incluso nello ZIP.</p></div></div>}
      {message && <div className="online-message" role="status"><Info size={15}/><span>{message}</span><button onClick={() => setMessage('')} aria-label="Chiudi messaggio"><X size={14}/></button></div>}
      <div className="online-workspace">
        <aside className="panel online-room-panel">
          <PanelHeading title="La stanza" action={<span className="count-tag"><Wifi size={12}/>{roomCode ? 'LIVE' : 'OFFLINE'}</span>} />
          {!roomCode ? <>
            <p>Un amico crea la stanza, gli altri entrano con il codice o con il link.</p>
            <button className="online-create-btn" disabled={!firebaseConfigured || working} onClick={() => { attemptRef.current = true; enterRoom('', true); }}><Plus size={17}/> Crea stanza</button>
            <div className="online-or">OPPURE INSERISCI UN CODICE</div>
            <div className="online-join-row"><input aria-label="Codice stanza" placeholder="ABCDEFGH" maxLength={8} value={codeInput} onChange={(e) => setCodeInput(cleanRoomCode(e.target.value))}/><button type="button" disabled={!firebaseConfigured || working || codeInput.length !== 8} onClick={() => { attemptRef.current = true; enterRoom(codeInput); }} aria-label="Entra nella stanza"><LogIn size={18}/></button></div>
          </> : <>
            <div className="online-code"><small>CODICE STANZA</small><strong>{roomCode}</strong></div>
            <button type="button" className="online-invite-btn" onClick={copyInvite}><Link2 size={17}/> Copia link invito</button>
            <div className="online-room-status"><span className="live-dot"/> {members.length}/5 CONNESSI · SI PARTE DA 2</div>
            <p className="online-expiry-note">Stanza eliminata dopo 30 min senza attività, o dopo 5 min se vuota (pulizia periodica).</p>
            <div className="online-members">
              {members.map((member) => (
                <div className="online-member" key={member.id}>
                  <Avatar player={member} size="small"/>
                  <span className="online-member-name"><strong>{member.name}</strong><small>{member.id === meta?.hostUid ? 'HOST' : member.id === uid ? 'TU' : 'GIOCATORE'}</small></span>
                  <span className={meta?.phase === 'waiting' && member.readyRound === meta.round ? 'online-ready-pill yes' : 'online-ready-pill'}>{meta?.phase === 'waiting' && member.readyRound === meta.round ? <CircleCheck size={15}/> : <CircleDashed size={15}/>} {meta?.phase === 'waiting' && member.readyRound === meta.round ? 'PRONTO' : 'ATTESA'}</span>
                </div>
              ))}
            </div>
            {meta?.phase === 'closed' && <p className="online-room-closed">La stanza è stata chiusa dall'host.</p>}
            <button className="online-leave-btn" type="button" disabled={working} onClick={() => leave(isHost)}><LogOut size={16}/> {isHost ? 'Chiudi stanza ed esci' : 'Lascia stanza'}</button>
          </>}
          <div className="online-divider"/>
          <span className="online-label"><Cloud size={14}/> PROFILO GOOGLE · PRIVATO</span>
          <div className="online-cloud-card">
            {googleAccount ? <>
              <strong className="cloud-identity">{account.displayName || account.email || 'Account Google'}</strong>
              <small>{cloudAutosave ? (cloudStatus || 'Sincronizzazione automatica attiva') : 'Scegli se caricare o salvare: nessuna sovrascrittura automatica.'}</small>
              <div className="online-import-buttons">
                <button type="button" disabled={cloudBusy || isReady || isBusy} onClick={pullCloud}><CloudDownload size={15}/> Carica</button>
                <button type="button" disabled={cloudBusy || isReady || isBusy} onClick={pushCloud}><CloudUpload size={15}/> Salva</button>
              </div>
              <button className="cloud-logout" type="button" disabled={cloudBusy || Boolean(roomCode)} onClick={googleLogout}>Esci da Google</button>
            </> : <>
              <p>Collega Google per ritrovare pool e consigli su altri dispositivi. Facoltativo: puoi continuare come ospite.</p>
              <button className="google-login" type="button" disabled={!firebaseConfigured || cloudBusy || Boolean(roomCode)} onClick={googleLogin}><LogIn size={15}/> Accedi con Google</button>
            </>}
          </div>
          <div className="online-divider"/>
          <span className="online-label"><Database size={14}/> BACKUP LOCALE</span>
          <div className="online-import-buttons"><button type="button" onClick={exportOwnProfile}><Download size={15}/> Esporta</button><button type="button" disabled={isReady || isBusy} onClick={() => importProfileRef.current?.click()}><Upload size={15}/> Importa</button></div>
          <p className="online-small-copy">Il profilo rimane anche nel browser; puoi sempre esportarlo in JSON. I dati del cloud sono leggibili solo dal tuo account.</p>
        </aside>

        <div className="online-editor-column">
          {room?.result && meta?.phase === 'results' ? <Results draw={room.result.draw} selections={room.result.selections} recommendations={room.result.recommendations || []}
            players={resultPlayers} champions={champions} version={version} assets={assets} drawRevision={drawRevision}
            mode={meta.mode} onShuffle={newRound} allowReroll={isHost} onCopy={copyOnlineResults} advice={room.result.advice || {}} showAdvice={Boolean(meta.showAdvice)} /> : isReady || meta?.phase === 'rolling' ? (
            <section className="panel online-locked-editor"><CheckCheck size={32}/><h3>{isReady ? 'Sei pronto!' : 'Roll in corso'}</h3><p>{isReady ? 'Il tuo profilo è stato inviato alla lobby. Puoi annullare Pronto per continuare a modificare le pool.' : 'La stanza sta generando il risultato.'}</p><div><Avatar player={profile} size="large"/><strong>{profile.name}</strong><span>{countSelected(profile)} campioni salvati</span></div></section>
          ) : <EditorPanel player={{ ...profile, id: 'me' }} champions={champions} version={version}
            onRename={(_, name) => changeProfile((previous) => ({ ...previous, name }))}
            onOpenPicker={setPickerRole}
            onRemove={(role, id) => updatePool(role, (ids) => ids.length > 1 ? ids.filter((current) => current !== id) : ids)}
            onMove={moveChamp} onAdvice={(role, championId) => setAdviceTarget({ role, championId })}/>
          }
        </div>

        <aside className="panel online-controls-panel">
          <PanelHeading title="Avvia la queue" action={<span className="count-tag">{meta?.round ? `ROUND ${meta.round}` : 'READY'}</span>} />
          {!roomCode ? <p>Entra in una stanza per sincronizzare le pool e mettere Pronto.</p> : <>
            <div className="online-phase"><span className="live-dot"/>{meta?.phase === 'rolling' ? 'SORTEGGIO...' : meta?.phase === 'results' ? 'RISULTATO PRONTO' : 'IN ATTESA'}</div>
            <p>{members.length < 2 ? 'In attesa di almeno un altro giocatore.' : `${members.length} giocatori: il roll parte quando tutti sono Pronto.`} Ogni profilo richiede almeno un campione per ruolo.</p>
            {meta?.phase === 'waiting' && <>
              <button className={`online-ready-btn ${isReady ? 'cancel' : ''}`} disabled={working || !me || (!profileComplete && !isReady)} onClick={toggleReady}>
                {isReady ? <CircleCheck size={19}/> : <Check size={19}/>} {isReady ? 'Annulla pronto' : 'SONO PRONTO'}
              </button>
              {!profileComplete && <small className="online-completion-warning">Pool incomplete: {countFilledRoles(profile)}/5 ruoli compilati.</small>}
              {isReady && <small className="online-completion-ok">In attesa degli altri giocatori. Il roll partirà da solo.</small>}
            </>}
            {meta?.phase === 'results' && <div className="online-done"><CheckCheck size={22}/><strong>Risultato condiviso!</strong><p>Tutti vedono gli stessi ruoli, campioni e composizioni.</p></div>}
            {isHost && meta?.phase === 'results' && <button className="online-restart-btn" onClick={newRound} disabled={working}><RotateCcw size={16}/> Nuovo round</button>}
            {isHost && meta?.phase === 'rolling' && <button className="online-restart-btn" onClick={recoverRoll} disabled={working}><RotateCcw size={16}/> Sblocca sorteggio</button>}
            {!isHost && <p className="online-host-note">Solo l'host può cambiare le impostazioni e avviare un nuovo round.</p>}
            <div className="online-settings">
              <span className="online-label"><SlidersHorizontal size={14}/> MODALITÀ {isHost ? '· HOST' : ''}</span>
              <div className="online-mode-grid"><button disabled={!isHost || meta?.phase !== 'waiting'} className={meta?.mode === 'classic' ? 'selected' : ''} onClick={() => setSettings({ mode: 'classic' })}>Classica</button><button disabled={!isHost || meta?.phase !== 'waiting'} className={meta?.mode === 'creative' ? 'selected' : ''} onClick={() => setSettings({ mode: 'creative' })}>Creativa</button></div>
              {meta?.mode === 'creative' && <select aria-label="Libertà creativa" disabled={!isHost || meta?.phase !== 'waiting'} value={meta?.tone || 'balanced'} onChange={(e) => setSettings({ tone: e.target.value })}><option value="faithful">Fedele</option><option value="balanced">Mix</option><option value="offmeta">Off-meta</option></select>}
              <label className="online-build-toggle"><input type="checkbox" checked={Boolean(meta?.showAdvice)} disabled={!isHost || meta?.phase !== 'waiting'} onChange={(e) => setSettings({ showAdvice: e.target.checked })}/><span>Mostra i consigli personali di rune e oggetti scritti dai giocatori</span></label>
            </div>
          </>}
        </aside>
      </div>
      {meta?.phase === 'rolling' && <RollOverlay frame={rollFrame} mode={meta.mode}/>}
      <input type="file" className="visually-hidden-file" ref={importProfileRef} accept=".json,application/json" onChange={importOwnProfile} aria-label="Importa profilo locale" />
      {pickerRole && <ChampionPicker key={`online-${pickerRole}`} roleId={pickerRole} player={{ ...profile, id: 'me' }} champions={champions} version={version} onToggle={toggleChamp} onClose={() => setPickerRole(null)}/>}
      {adviceTarget && <AdviceModal key={`${adviceTarget.role}-${adviceTarget.championId}`} roleId={adviceTarget.role} championId={adviceTarget.championId} profile={profile} champions={champions} version={version} assets={assets} onSave={updateAdvice} onClose={() => setAdviceTarget(null)}/>}
    </div>
  );
}

export default function App() {
  const [workspaceView, setWorkspaceView] = useState(() => 'online');
  const [soloResultsOpen, setSoloResultsOpen] = useState(false);
  const [homeNonce, setHomeNonce] = useState(0);
  const [localRequest, setLocalRequest] = useState(0);
  const [saved, setSaved] = useState(readStoredState);
  const [draw, setDraw] = useState(null);
  const [selections, setSelections] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [soloAdvice, setSoloAdvice] = useState({});
  const [mode, setMode] = useState('classic');
  const [tone, setTone] = useState('balanced');
  const [rolling, setRolling] = useState(false);
  const [rollFrame, setRollFrame] = useState(null);
  const [drawRevision, setDrawRevision] = useState(0);
  const importInputRef = useRef(null);
  const rollTimersRef = useRef(null);
  const [pickerRole, setPickerRole] = useState(null);
  const [adviceTarget, setAdviceTarget] = useState(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [toast, setToast] = useState('');
  const { champions, version, source } = useChampionCatalogue();
  const assets = useGameAssets(version);

  const { players, lobbyIds, selectedId } = saved;
  const selectedPlayer = players.find((player) => player.id === selectedId) || players[0];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
    catch { /* Se lo storage è disabilitato, l'app resta utilizzabile. */ }
  }, [saved]);

  useEffect(() => () => {
    if (rollTimersRef.current) {
      clearInterval(rollTimersRef.current.interval);
      clearTimeout(rollTimersRef.current.timeout);
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pickerRole && !showAddPlayer) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { setPickerRole(null); setShowAddPlayer(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [pickerRole, showAddPlayer]);

  function renamePlayer(id, name) {
    setSaved((previous) => ({
      ...previous,
      players: previous.players.map((p) => p.id === id ? { ...p, name } : p),
    }));
  }

  function updatePool(role, update) {
    setDraw(null);
    setSelections(null);
    setRecommendations([]);
    setSaved((previous) => ({
      ...previous,
      players: previous.players.map((p) => {
        if (p.id !== previous.selectedId) return p;
        const current = p.pools[role] || [];
        return { ...p, pools: { ...p.pools, [role]: update(current) } };
      }),
    }));
  }

  function updateSoloAdvice(role, championId, draft) {
    setSaved((previous) => ({ ...previous, players: previous.players.map((player) =>
      player.id === previous.selectedId
        ? { ...player, advice: cleanAdvice({ ...player.advice, [role]: { ...player.advice?.[role], [championId]: draft } }, player.pools) }
        : player),
    }));
  }

  function toggleChampion(role, id) {
    updatePool(role, (ids) => ids.includes(id) ? (ids.length > 1 ? ids.filter((champId) => champId !== id) : ids)
      : [...ids, id]);
  }

  function moveChampion(role, index, direction) {
    updatePool(role, (ids) => {
      const next = [...ids];
      const target = index + direction;
      if (target < 0 || target >= next.length) return ids;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addPlayer(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.some((p) => p.name.trim().toLocaleLowerCase('it') === trimmed.toLocaleLowerCase('it'))) {
      setToast('Esiste già un giocatore con questo nome.');
      return;
    }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const player = { id, name: trimmed, accent: ACCENTS[players.length % ACCENTS.length], pools: blankPools() };
    setSaved((previous) => ({
      ...previous,
      players: [...previous.players, player],
      selectedId: id,
      lobbyIds: previous.lobbyIds.length < 5 ? [...previous.lobbyIds, id] : previous.lobbyIds,
    }));
    setDraw(null);
    setSelections(null);
    setRecommendations([]);
    setShowAddPlayer(false);
    setToast(`Profilo di ${trimmed} creato. Ora scegli i campioni.`);
  }

  function removePlayer(id) {
    if (players.length <= 1) return;
    const player = players.find((p) => p.id === id);
    if (!player || !window.confirm(`Eliminare il profilo di ${player.name}? Le sue pool verranno cancellate.`)) return;
    setSaved((previous) => {
      const nextPlayers = previous.players.filter((p) => p.id !== id);
      return {
        ...previous,
        players: nextPlayers,
        lobbyIds: previous.lobbyIds.filter((lobbyId) => lobbyId !== id),
        selectedId: previous.selectedId === id ? nextPlayers[0].id : previous.selectedId,
      };
    });
    setDraw(null);
    setSelections(null);
    setRecommendations([]);
  }

  function toggleLobby(id) {
    const isActive = lobbyIds.includes(id);
    if (!isActive && lobbyIds.length >= 5) {
      setToast('Massimo 5 giocatori per lobby.');
      return;
    }
    setSaved((previous) => ({
      ...previous,
      lobbyIds: isActive ? previous.lobbyIds.filter((item) => item !== id) : [...previous.lobbyIds, id],
    }));
    setDraw(null);
    setSelections(null);
    setRecommendations([]);
  }

  function shuffleLobby() {
    if (rolling || rollTimersRef.current) return;
    const active = lobbyIds.map((id) => players.find((p) => p.id === id)).filter(Boolean);
    try {
      const nextDraw = generateDraw(active);
      validateLobbyPools(active);
      const nextSelections = generateRoleSelections(nextDraw, active);
      const nextRecommendations = generateRecommendedComps(nextDraw, active, nextSelections, mode, tone);
      const nextAdvice = adviceForDraw(nextDraw, active, nextSelections, nextRecommendations);
      const reveal = () => {
        setDraw(nextDraw);
        setSelections(nextSelections);
        setRecommendations(nextRecommendations);
        setSoloAdvice(nextAdvice);
        setDrawRevision((previous) => previous + 1);
        setRolling(false);
        rollTimersRef.current = null;
        setSoloResultsOpen(true);
      };
      setDraw(null);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        reveal();
        return;
      }
      setRolling(true);
      const tick = () => {
        const result = nextDraw[Math.floor(Math.random() * nextDraw.length)];
        const player = active.find((p) => p.id === result.playerId);
        const donor = active.find((p) => p.id === result.donorId);
        setRollFrame({
          player: player?.name || 'Player',
          donor: donor?.name || 'Player',
          role: Math.random() > .5 ? result.primary : result.secondary,
        });
      };
      tick();
      const interval = setInterval(tick, 115);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reveal();
      }, 1700);
      rollTimersRef.current = { interval, timeout };
    } catch (error) {
      setToast(error.message);
    }
  }

  function exportPools() {
    try {
      const blob = new Blob([createPoolsFile(saved)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rift-roulette-pool-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Backup JSON scaricato: contiene tutte le pool e i profili.');
    } catch {
      setToast('Non è stato possibile esportare le pool.');
    }
  }

  async function importPools(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Permette di selezionare due volte lo stesso file.
    if (!file) return;
    if (file.size > 2_000_000) {
      setToast('File troppo grande: il limite è 2 MB.');
      return;
    }
    try {
      const nextState = parsePoolsFile(await file.text());
      if (!window.confirm(`Importare ${nextState.players.length} profili dal file? I profili attuali verranno sostituiti. Puoi prima esportarli per sicurezza.`)) return;
      setSaved(nextState);
      setDraw(null);
      setSelections(null);
      setRecommendations([]);
      setPickerRole(null);
      setToast(`${nextState.players.length} profili importati correttamente.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile importare il file.');
    }
  }

  async function copyResults() {
    if (!draw) return;
    const lines = [`RIFT ROULETTE — ${mode === 'creative' ? 'TEAMCOMP CREATIVA' : 'POOL CLASSICA'}`, ''];
    for (const item of draw) {
      const player = players.find((p) => p.id === item.playerId);
      const donor = players.find((p) => p.id === item.donorId);
      if (!player || !donor) continue;
      lines.push(`${player.name}: ${item.primary} + ${item.secondary} (pool di ${donor.name})`);
      for (const kind of ['primary', 'secondary']) {
        const role = item[kind];
        const ids = selections?.[item.playerId]?.[kind] || [];
        const names = ids.map((id) => getChampById(id, champions).name);
        lines.push(`  ${role}: ${names.join(' / ')}${names.length ? ' (primo = principale)' : ''}`);
      }
      lines.push('');
    }
    for (const comp of recommendations) {
      lines.push(`${comp.label} — ${comp.style.label}`);
      for (const pick of comp.picks) {
        lines.push(`  ${pick.primary}: ${players.find((p) => p.id === pick.playerId)?.name} · ${getChampById(pick.id, champions).name}${pick.isPool ? '' : ' [EXTRA]'}`);
      }
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setToast('Risultato copiato negli appunti.');
    } catch {
      setToast('Impossibile copiare automaticamente dal browser.');
    }
  }

  return (
    <div className="app-shell compact-app">
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => { setWorkspaceView('online'); setHomeNonce((n) => n + 1); setSoloResultsOpen(false); }} aria-label="Rift Roulette · torna alla home">
            <span className="brand-symbol"><Shuffle size={21}/></span>
            <span className="brand-name">RIFT<span>ROULETTE</span></span>
          </button>
          <nav className="header-actions" aria-label="Navigazione">
            <button type="button" onClick={() => { setWorkspaceView('online'); setHomeNonce((n) => n+1); setSoloResultsOpen(false); }}><Home size={15}/> <span>Home</span></button>
            <button type="button" className={workspaceView === 'online' ? 'active' : ''} onClick={() => { setWorkspaceView('online'); setSoloResultsOpen(false); }}><Wifi size={15}/> <span>Multiplayer</span></button>
            <button type="button" className={workspaceView === 'solo' ? 'active' : ''} onClick={() => { if (workspaceView === 'online') setLocalRequest((n)=>n+1); else setWorkspaceView('solo'); }}><Layers3 size={15}/> <span>Locale</span></button>
          </nav>
        </div>
      </header>
      <main className="page app-stage">
        {workspaceView === 'online' ? <OnlineParty champions={champions} version={version} assets={assets} homeNonce={homeNonce} localRequest={localRequest} onGoLocal={() => setWorkspaceView('solo')}/> : <>
          <div className="compact-intro"><div><span className="section-eyebrow"><Layers3 size={13}/> MODALITÀ LOCALE</span><h1>Champion pool &amp; lobby</h1></div>
            {draw && <button className="compact-results-button" type="button" onClick={() => setSoloResultsOpen(true)}><Swords size={15}/> Apri risultati</button>}</div>
          <div className="workspace compact-workspace">
            <PlayersPanel players={players} selectedId={selectedPlayer.id}
              onSelect={(id) => setSaved((previous) => ({ ...previous, selectedId: id }))}
              onAdd={() => setShowAddPlayer(true)} onRemove={removePlayer}
              onExport={exportPools} onImport={() => importInputRef.current?.click()} />
            <EditorPanel player={selectedPlayer} champions={champions} version={version}
              onRename={renamePlayer} onOpenPicker={setPickerRole}
              onRemove={(role, id) => updatePool(role, (ids) => ids.length > 1 ? ids.filter((championId) => championId !== id) : ids)}
              onMove={moveChampion} onAdvice={(role, championId) => setAdviceTarget({ role, championId })}/>
            <LobbyPanel players={players} lobbyIds={lobbyIds} draw={draw}
              onToggle={toggleLobby} onShuffle={shuffleLobby} rolling={rolling}
              mode={mode} tone={tone}
              onMode={(value) => { setMode(value); setDraw(null); setSelections(null); setRecommendations([]); }}
              onTone={(value) => { setTone(value); setDraw(null); setSelections(null); setRecommendations([]); }} />
          </div>
          {soloResultsOpen && draw && <div className="modal-backdrop result-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSoloResultsOpen(false); }}>
            <div className="result-window" role="dialog" aria-modal="true" aria-label="Risultati della lobby"><button type="button" className="result-window-close" onClick={() => setSoloResultsOpen(false)}><X size={17}/> Torna alle pool</button>
              <Results draw={draw} players={players} champions={champions} version={version} assets={assets}
                onShuffle={shuffleLobby} onCopy={copyResults} drawRevision={drawRevision}
                mode={mode} selections={selections} recommendations={recommendations} advice={soloAdvice}/>
            </div>
          </div>}
        </>}
        <div className="app-source"><span className={source === 'riot' ? 'live-dot' : 'muted-dot'}/>{source === 'riot' ? `Riot Data Dragon · ${version}` : 'Catalogo di riserva'} · Fan project non affiliato a Riot Games</div>
      </main>

      <input ref={importInputRef} type="file" accept=".json,application/json"
        className="visually-hidden-file" tabIndex={-1} aria-label="Seleziona backup delle pool"
        onChange={importPools} />
      {workspaceView === 'solo' && rolling && <RollOverlay frame={rollFrame} mode={mode} />}
      {workspaceView === 'solo' && pickerRole && <ChampionPicker key={`${selectedPlayer.id}-${pickerRole}`}
        roleId={pickerRole} player={selectedPlayer} champions={champions} version={version}
        onToggle={toggleChampion} onClose={() => setPickerRole(null)} />}
      {workspaceView === 'solo' && adviceTarget && <AdviceModal key={`${selectedPlayer.id}-${adviceTarget.role}-${adviceTarget.championId}`} roleId={adviceTarget.role} championId={adviceTarget.championId} profile={selectedPlayer} champions={champions} version={version} assets={assets} onSave={updateSoloAdvice} onClose={() => setAdviceTarget(null)}/>}
      {workspaceView === 'solo' && showAddPlayer && <AddPlayerModal onClose={() => setShowAddPlayer(false)} onAdd={addPlayer} />}
      {toast && <div className="toast" role="status"><Info size={16} /> {toast}<button type="button" onClick={() => setToast('')} aria-label="Chiudi notifica"><X size={15} /></button></div>}
    </div>
  );
}
