# Rift Roulette 6.2 — Interfaccia compatta e catalogo oggetti corretto

Questa versione parte dalla **6.1**: tutte le funzionalità multiplayer, login Google, profili, consigli personali e pulizia automatica delle stanze restano disponibili.

### Modifiche rispetto alla v6.1

- Rimossi la dicitura `panel-step` e il titolo «Una stanza, la vostra Rift.».
- Strip introduttiva dei campioni con dimensioni coerenti e resa responsive, compresi gli schermi piccoli.
- Editor delle champion pool con intestazione fissa, contenuto a scorrimento interno e card più ordinate.
- Catalogo degli **oggetti**: caricamento Riot con fallback `it_IT` → `en_US`, errori visibili invece di un elenco vuoto, ricerca su tutto il catalogo anziché sui primi 160 elementi, immagini con fallback e limite di 6 selezioni evidenziato. Le rune e le build continuano a essere **scelte manualmente dall'utente**.
- Nessuna modifica alle regole Firebase o ai Secrets GitHub rispetto alla v6.1.

### Come aggiornare il sito già pubblicato su GitHub Pages

Sostituisci i file della v6.1 con quelli nello ZIP **senza cancellare** il tuo `.env.local`, `.git` o `package-lock.json` esistente. Dalla cartella del repository:

```bash
npm install
npm test
npm run build
git add .
git commit -m "Rift Roulette 6.2: UI e oggetti"
git push
```

GitHub Actions ripubblicherà il sito dopo il push. Se il browser mostra ancora la versione precedente, esegui un refresh forzato (`Ctrl+Shift+R`). Il workflow di pulizia delle stanze continua a funzionare senza modifiche.

---

# Guida originale — Stanze con scadenza e deploy GitHub Pages

Sito React + Vite + Firebase Realtime Database. La modalità predefinita è **multiplayer**; restano disponibili modalità locale, pool personali, rune/item scelti dall'utente, import/export JSON e login Google con profilo cloud.

## Scadenza automatica stanze

- **Con almeno un partecipante**: la stanza viene eliminata dopo **30 minuti senza interazioni**. Sono attività: ingresso, modifica di pool, Pronto/non Pronto, modifica impostazioni, sorteggio e nuovo round. Il sito NON manda heartbeat periodici: una scheda lasciata aperta senza attività non impedisce la scadenza.
- **Senza partecipanti**: dopo **5 minuti dall'ultima uscita/disconnessione**, la stanza viene eliminata. Si usa `lastPresenceAt` generato dal server Realtime Database. In stanze vecchie senza questo campo si usa l'ultima attività disponibile.
- **Stanza chiusa dall'host**: viene cancellata alla successiva esecuzione del job.
- **Controllo ogni 5 minuti** con GitHub Actions (`.github/workflows/cleanup-rooms.yml`). Un job schedulato **non è garantito al minuto**: GitHub può ritardare o saltare una run; i tempi di cancellazione sono quindi approssimativi.
- La pulizia agisce **esclusivamente su `/rooms`**, mai su `/privateProfiles`: i profili Google e i consigli personali non vengono eliminati.
- L'eliminazione usa una **transazione Firebase** che ricontrolla lo stato prima della cancellazione, riducendo il rischio di rimuovere stanze diventate attive nel frattempo.

**Importante:** GitHub sospende automaticamente i workflow `schedule` dei repository pubblici dopo **60 giorni di inattività del repository**. In quel caso devi riattivare il workflow da **Actions** (oppure usare un servizio di scheduling differente). Non è una scadenza garantita con SLA.
  
