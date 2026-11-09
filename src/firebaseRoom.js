import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { getDatabase, get, onValue, ref, runTransaction, set, update, onDisconnect, serverTimestamp } from 'firebase/database';
import { cleanOwnProfile, makeRoomCode, cleanRoomCode } from './roomLogic.js';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(firebaseConfig).every((value) => typeof value === 'string' && value.length > 0);
const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getDatabase(app) : null;

// Aggiorna l'ultima attivita' SOLO per interazioni reali, non con heartbeat.
export function markRoomActivity(code) {
  if (!db || !code) return Promise.resolve();
  return set(ref(db, `rooms/${code}/lastActivityAt`), serverTimestamp());
}
export const isGoogleAccount = (user) => Boolean(user && !user.isAnonymous && user.providerData.some((p) => p.providerId === 'google.com'));

export function watchAuth(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function connectGoogle() {
  await loginAnonymously();
  const current = auth.currentUser;
  if (isGoogleAccount(current)) return current;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    // Upgrade del guest: mantiene uid e proprieta' delle stanze se l'account Google e' nuovo.
    const result = current?.isAnonymous
      ? await linkWithPopup(current, provider)
      : await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    if (['auth/credential-already-in-use', 'auth/email-already-in-use', 'auth/provider-already-linked'].includes(error.code)) {
      // Google esistente: accede a quell'account. I dati locali NON vengono sovrascritti.
      const credential = GoogleAuthProvider.credentialFromError(error);
      return (credential ? await signInWithCredential(auth, credential) : await signInWithPopup(auth, provider)).user;
    }
    throw error;
  }
}

export async function disconnectGoogle() {
  if (!auth) throw new Error('Firebase non configurato.');
  await signOut(auth);
  const guest = await signInAnonymously(auth);
  loginPromise = Promise.resolve(guest.user.uid);
  return guest.user;
}

function requireGoogle() {
  if (!isGoogleAccount(auth?.currentUser)) throw new Error('Accedi prima con Google.');
  return auth.currentUser.uid;
}

export async function saveCloudProfile(profile) {
  const uid = requireGoogle();
  await set(ref(db, `privateProfiles/${uid}`), {
    profile: cleanOwnProfile(profile), updatedAt: Date.now(), schema: 1,
  });
}

export async function loadCloudProfile() {
  const uid = requireGoogle();
  const snapshot = await get(ref(db, `privateProfiles/${uid}`));
  if (!snapshot.exists()) return null;
  return cleanOwnProfile(snapshot.val()?.profile);
}

let loginPromise;
export function loginAnonymously() {
  if (!firebaseConfigured) return Promise.reject(new Error('Firebase non configurato. Segui le istruzioni del README.'));
  // L'uid puo' cambiare dopo un accesso a un account Google gia' esistente.
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
  if (!loginPromise) {
    loginPromise = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) { resolve(user.uid); return; }
        try { resolve((await signInAnonymously(auth)).user.uid); }
        catch (error) { reject(error); }
      }, reject);
    }).catch((error) => { loginPromise = null; throw error; });
  }
  return loginPromise;
}

export async function createRoom() {
  const uid = await loginAnonymously();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const meta = { hostUid: uid, createdAt: Date.now(), phase: 'waiting', round: 1,
      mode: 'classic', tone: 'balanced', showAdvice: true };
    const transaction = await runTransaction(ref(db, `rooms/${code}/meta`), (current) =>
      current === null ? meta : undefined, { applyLocally: false });
    if (transaction.committed) {
      await markRoomActivity(code);
      return { code, uid };
    }
  }
  throw new Error('Non è stato possibile generare una stanza. Riprova.');
}

export async function assertRoomExists(code) {
  const uid = await loginAnonymously();
  const normalized = cleanRoomCode(code);
  if (normalized.length !== 8) throw new Error('Inserisci un codice stanza di 8 caratteri.');
  const snapshot = await get(ref(db, `rooms/${normalized}/meta`));
  if (!snapshot.exists() || snapshot.val().phase === 'closed') throw new Error('Stanza inesistente o chiusa.');
  return { code: normalized, uid, meta: snapshot.val() };
}

export async function joinRoom(code, uid, profile, round) {
  const metaSnapshot = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnapshot.exists() || metaSnapshot.val().phase === 'closed') {
    throw new Error('Questa stanza è stata chiusa o è scaduta.');
  }
  const memberRef = ref(db, `rooms/${code}/members/${uid}`);
  const alreadyThere = await get(memberRef);
  if (!alreadyThere.exists()) {
    const members = (await get(ref(db, `rooms/${code}/members`))).val() || {};
    if (Object.keys(members).length >= 5) throw new Error('La stanza è piena (5/5).');
  }
  // Fallback registrato PRIMA dell'ingresso: evita membri fantasma durante un crash.
  await onDisconnect(memberRef).remove();
  await set(memberRef, { ...cleanOwnProfile(profile), online: true, readyRound: 0,
    joinedAt: alreadyThere.val()?.joinedAt || Date.now() });
  // Sostituisce il fallback con una rimozione atomica + orario dell'ultima uscita.
  // Viene rieseguito a ogni riconnessione (le onDisconnect sono one-shot).
  await onDisconnect(ref(db, `rooms/${code}`)).update({
    [`members/${uid}`]: null, lastPresenceAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  await onDisconnect(memberRef).cancel();
  await markRoomActivity(code);
  return round;
}

export function watchRoom(code, onRoom, onError) {
  return onValue(ref(db, `rooms/${code}`), (snap) => onRoom(snap.val()), onError);
}

export async function updateMember(code, uid, profile, readyRound) {
  const memberRef = ref(db, `rooms/${code}/members/${uid}`);
  await update(memberRef, { ...cleanOwnProfile(profile), online: true, readyRound });
  await markRoomActivity(code);
}

export async function leaveRoom(code, uid) {
  const memberRef = ref(db, `rooms/${code}/members/${uid}`);
  await update(ref(db, `rooms/${code}`), {
    [`members/${uid}`]: null, lastPresenceAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  await onDisconnect(ref(db, `rooms/${code}`)).cancel();
  await onDisconnect(memberRef).cancel();
}

export async function changeRoomSettings(code, values) {
  await update(ref(db, `rooms/${code}/meta`), values);
  await markRoomActivity(code);
}

export async function submitRoll(code, result, round) {
  await update(ref(db, `rooms/${code}`), {
    result: { ...result, round, createdAt: Date.now() }, 'meta/phase': 'results',
    lastActivityAt: serverTimestamp(),
  });
}

export async function restartRoom(code, round) {
  await update(ref(db, `rooms/${code}`), {
    result: null, 'meta/phase': 'waiting', 'meta/round': round + 1,
    lastActivityAt: serverTimestamp(),
  });
}

export async function closeRoom(code) {
  await update(ref(db, `rooms/${code}`), {
    'meta/phase': 'closed', lastActivityAt: serverTimestamp(),
  });
}

export async function beginRoll(code) {
  const tx = await runTransaction(ref(db, `rooms/${code}/meta/phase`), (phase) =>
    phase === 'waiting' ? 'rolling' : undefined, { applyLocally: false });
  if (tx.committed) await markRoomActivity(code);
  return tx.committed;
}

export function watchConnection(onStatus) {
  return onValue(ref(db, '.info/connected'), (snapshot) => onStatus(snapshot.val() === true));
}
