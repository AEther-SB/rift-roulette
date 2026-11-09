/**
 * Cron su GitHub Actions: rimuove soltanto /rooms, mai /privateProfiles.
 * Non importare questa funzione dal client: firebase-admin usa privilegi elevati.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { roomCleanupReason } from '../src/roomCleanupPolicy.js';

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!json || !databaseURL) {
  console.error('Secrets mancanti: FIREBASE_SERVICE_ACCOUNT_JSON e FIREBASE_DATABASE_URL.');
  process.exitCode = 1;
} else {
  try {
    const account = JSON.parse(json);
    if (typeof account.private_key !== 'string' || typeof account.client_email !== 'string') {
      throw new Error('Il JSON del service account non è valido.');
    }
    if (!getApps().length) initializeApp({ credential: cert(account), databaseURL });
    const db = getDatabase();
    const roomsRef = db.ref('rooms');
    const snapshot = await roomsRef.get();
    const rooms = snapshot.val() || {};
    let deleted = 0;
    for (const [code, room] of Object.entries(rooms)) {
      // Evita transazioni su stanze ancora attive.
      if (!roomCleanupReason(room)) continue;
      let reason = null;
      // Transazione: una stanza toccata tra scan e delete NON viene cancellata.
      const tx = await db.ref(`rooms/${code}`).transaction((latest) => {
        if (latest === null) return undefined; // gia' rimossa da un altro worker
        reason = roomCleanupReason(latest);
        return reason ? null : undefined;
      }, undefined, false);
      if (tx.committed) {
        deleted++;
        console.log(`Eliminata stanza ${code}: ${reason}`);
      }
    }
    console.log(`Pulizia completata: ${deleted} eliminate, ${Object.keys(rooms).length} esaminate.`);
  } catch (error) {
    console.error('Errore durante la pulizia:', error.message);
    process.exitCode = 1;
  }
}
