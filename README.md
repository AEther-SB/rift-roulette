# Rift Roulette 6.2 — Interfaccia compatta e catalogo oggetti corretto

Questa versione parte dalla **6.1**: tutte le funzionalità multiplayer, login Google, profili, consigli personali e pulizia automatica delle stanze restano disponibili.

### Modifiche rispetto alla v6.1

- Rimossi la dicitura `panel-step` e il titolo «Una stanza, la vostra Rift.».
- Strip introduttiva dei campioni con dimensioni coerenti e resa responsive, compresi gli schermi piccoli.
- Editor delle champion pool con intestazione fissa, contenuto a scorrimento interno e card più ordinate.
- Catalogo degli **oggetti**: caricamento Riot con fallback `it_IT` → `en_US`, errori visibili invece di un elenco vuoto, ricerca su tutto il catalogo anziché sui primi 160 elementi, immagini con fallback e limite di 6 selezioni evidenziato. Le rune e le build continuano a essere **scelte manualmente dall'utente**.
- Nessuna modifica alle regole Firebase o ai Secrets GitHub rispetto alla v6.1.
 
## Scadenza automatica stanze

- **Con almeno un partecipante**: la stanza viene eliminata dopo **30 minuti senza interazioni**. Sono attività: ingresso, modifica di pool, Pronto/non Pronto, modifica impostazioni, sorteggio e nuovo round. Il sito NON manda heartbeat periodici: una scheda lasciata aperta senza attività non impedisce la scadenza.
- **Senza partecipanti**: dopo **5 minuti dall'ultima uscita/disconnessione**, la stanza viene eliminata. Si usa `lastPresenceAt` generato dal server Realtime Database. In stanze vecchie senza questo campo si usa l'ultima attività disponibile.
- **Stanza chiusa dall'host**: viene cancellata alla successiva esecuzione del job.
- **Controllo ogni 5 minuti** con GitHub Actions (`.github/workflows/cleanup-rooms.yml`). Un job schedulato **non è garantito al minuto**: GitHub può ritardare o saltare una run; i tempi di cancellazione sono quindi approssimativi.
- La pulizia agisce **esclusivamente su `/rooms`**, mai su `/privateProfiles`: i profili Google e i consigli personali non vengono eliminati.
- L'eliminazione usa una **transazione Firebase** che ricontrolla lo stato prima della cancellazione, riducendo il rischio di rimuovere stanze diventate attive nel frattempo.
 
