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

## 1. Aggiorna il tuo progetto Firebase

Apri **Firebase Console → Realtime Database → Rules**. Sostituisci tutto con il nuovo file `database.rules.json`, quindi **Publish**. Le nuove regole autorizzano solo i partecipanti o l'host a scrivere i timestamp di presenza/attività; i timestamp sono generati dal server (`serverTimestamp()`).

Non modificare le impostazioni dell'Authentication esistenti: **Anonymous** e **Google** devono restare abilitati. In **Authentication → Settings → Authorized domains** verifica `localhost` per test locali.

## 2. Prova in locale

Copia il precedente `.env.local` della v6 nella stessa cartella di `package.json`; non viene fornito nello ZIP. Mantieni questi 5 valori:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Poi:

```bash
npm install
npm test
npm run build
npm run dev
```

Apri `http://localhost:5173`. Le stanze locali funzionano, ma **la pulizia pianificata non parte finché non pubblichi il workflow su GitHub e ne configuri il secret Admin**.

## 3. Crea il repository GitHub

1. Su https://github.com/new crea un repository **pubblico**, es. `rift-roulette`. Non selezionare README o .gitignore aggiuntivi: sono già forniti.
2. Apri il terminale nella **cartella che contiene `package.json`**, non nella cartella che contiene lo ZIP.
3. Inizializza Git e carica i file:

```bash
git init
git add .
git commit -m "Rift Roulette 6.1"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/rift-roulette.git
git push -u origin main
```

Per i comandi Git devi avere Git installato e un metodo di accesso al tuo account GitHub (ad esempio Git Credential Manager/`gh auth login`). Il file `.env.local` è escluso da `.gitignore`: **non caricarlo**. Se il repository esiste già, aggiorna i file anziché creare un altro repository. Il file `package-lock.json` generato da `npm install` viene incluso nel commit.

## 4. Configura i Secrets GitHub per la build

Nel repo vai in **Settings → Secrets and variables → Actions → New repository secret**.

Crea questi cinque secrets con gli stessi valori del tuo `.env.local`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

**Nota:** tutte le variabili con prefisso `VITE_` finiscono nel bundle pubblico della web app. Le chiavi Firebase **Web SDK** sono pensate per essere pubbliche; le regole Realtime Database e Firebase Auth proteggono i dati. Non usare mai una chiave privata Admin in una variabile `VITE_`.

## 5. Configura il secret per la pulizia programmata

Questa è l'**unica** credenziale veramente segreta.

1. Apri **Firebase Console → Impostazioni progetto (ingranaggio) → Account di servizio**.
2. Seleziona **Genera nuova chiave privata**. Il browser scaricherà un file JSON del **service account**.
3. In GitHub, **Settings → Secrets and variables → Actions → New repository secret**.
4. Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`. Valore: **l'intero contenuto del file JSON**, incluse le parentesi graffe iniziali e finali.
5. **Non** inserire il JSON in `src`, `.env.local`, in un commit, in uno screenshot pubblico o nei messaggi della chat. Conserva il file al sicuro o eliminalo dalla cartella Download dopo aver registrato il secret.

Il service account conferisce privilegi amministrativi e il suo uso richiede particolare attenzione. Il workflow di pulizia utilizza soltanto la variabile `FIREBASE_SERVICE_ACCOUNT_JSON` lato GitHub Actions; non compare mai nel sito pubblicato.

Il file `.github/workflows/cleanup-rooms.yml` legge anche `VITE_FIREBASE_DATABASE_URL`, già creato al punto 4.

## 6. Pubblica con GitHub Pages

1. Nel repository, vai su **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions**.
3. Dal tab **Actions**, apri il workflow **Pubblica Rift Roulette su GitHub Pages** (`pages.yml`) e premi **Run workflow** se non è già partito dopo il push.
4. Quando il job è verde, apri `https://TUO-USERNAME.github.io/rift-roulette/`. Il progetto imposta automaticamente il `base` corretto in Vite per il repository GitHub Pages.
5. In **Firebase → Authentication → Settings → Authorized domains**, aggiungi il dominio `TUO-USERNAME.github.io` (senza `https://`, percorso o slash finale) per Google Authentication.

Per repository `TUO-USERNAME.github.io` (sito root), Vite usa `base: '/'`. Il workflow `pages.yml` è già incluso.

## 7. Verifica il job di pulizia

Dopo aver creato il secret `FIREBASE_SERVICE_ACCOUNT_JSON`:

1. Vai su **GitHub → repository → Actions**.
2. Seleziona **Pulizia automatica stanze Firebase**.
3. Premi **Run workflow → Run workflow**. Il job dovrebbe stampare `Pulizia completata: …`.
4. Per un test realistico, crea una stanza, esci da entrambi i browser, attendi almeno 5 minuti e avvia di nuovo manualmente il workflow. Controlla **Firebase → Realtime Database → Data**: la stanza deve sparire da `/rooms`.

I job pianificati girano ogni cinque minuti circa sulla branch `main`; potrebbero arrivare in ritardo. Il job **non** viene eseguito automaticamente da `npm run dev`. Non pubblicare mai il service account per testarlo in locale.

## Sicurezza, prezzi e limitazioni

- GitHub Pages ospita gratuitamente un sito statico; Firebase Realtime Database / Authentication si appoggiano al piano Spark finché rientri nelle quote. La pulizia con GitHub Actions non usa le Cloud Functions a pagamento.
- **Pubblica il repository senza credenziali private.** Le regole del database sono necessarie: Firebase Admin bypassa le regole, quindi proteggi i Secrets di GitHub e limita chi può modificare i workflow del repository.
- Stanze identificabili tramite codice; le pool e i consigli condivisi nella lobby non devono contenere dati sensibili. I profili Google sotto `/privateProfiles/{uid}` rimangono protetti.
- Il limite di 5 membri è ancora applicato dal client, non atomicamente dal database. Il sorteggio resta avviato dal browser dell'host.
- La v6.1 richiede **aggiornamento delle regole** Firebase; non è sufficiente sostituire lo ZIP.
- Se i job di GitHub hanno errori npm, controlla `npm audit` e le dipendenze. Evita `npm audit fix --force` senza verifiche.

Fonti:
- https://vite.dev/guide/static-deploy
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://firebase.google.com/docs/database/web/offline-capabilities
- https://firebase.google.com/docs/admin/setup
