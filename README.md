# Rift Roulette 6.1 — Stanze con scadenza e deploy GitHub Pages

Sito React + Vite + Firebase Realtime Database. La modalità predefinita è **multiplayer**; restano disponibili modalità locale, pool personali, rune/item scelti dall'utente, import/export JSON e login Google con profilo cloud.

## Scadenza automatica stanze

- **Con almeno un partecipante**: la stanza viene eliminata dopo **30 minuti senza interazioni**. Sono attività: ingresso, modifica di pool, Pronto/non Pronto, modifica impostazioni, sorteggio e nuovo round. Il sito NON manda heartbeat periodici: una scheda lasciata aperta senza attività non impedisce la scadenza.
- **Senza partecipanti**: dopo **5 minuti dall'ultima uscita/disconnessione**, la stanza viene eliminata. Si usa `lastPresenceAt` generato dal server Realtime Database. In stanze vecchie senza questo campo si usa l'ultima attività disponibile.
- **Stanza chiusa dall'host**: viene cancellata alla successiva esecuzione del job.
- **Controllo ogni 5 minuti** con GitHub Actions (`.github/workflows/cleanup-rooms.yml`). Un job schedulato **non è garantito al minuto**: GitHub può ritardare o saltare una run; i tempi di cancellazione sono quindi approssimativi.
- La pulizia agisce **esclusivamente su `/rooms`**, mai su `/privateProfiles`: i profili Google e i consigli personali non vengono eliminati.
- L'eliminazione usa una **transazione Firebase** che ricontrolla lo stato prima della cancellazione, riducendo il rischio di rimuovere stanze diventate attive nel frattempo.

**Importante:** GitHub sospende automaticamente i workflow `schedule` dei repository pubblici dopo **60 giorni di inattività del repository**. In quel caso devi riattivare il workflow da **Actions** (oppure usare un servizio di scheduling differente). Non è una scadenza garantita con SLA.
  
