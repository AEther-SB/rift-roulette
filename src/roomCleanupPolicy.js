// Mantenere questo file senza dipendenze Firebase: viene usato anche dai test Node.
export const ROOM_IDLE_MS = 30 * 60 * 1000;
export const ROOM_EMPTY_MS = 5 * 60 * 1000;

function timestamp(value, now) {
  return Number.isFinite(value) && value >= 0 && value <= now + 60_000 ? value : 0;
}

export function roomCleanupReason(room, now = Date.now()) {
  if (!room || !room.meta) return 'invalid';
  if (room.meta.phase === 'closed') return 'closed';

  const fallback = timestamp(room.meta.createdAt, now);
  const lastActivity = timestamp(room.lastActivityAt, now) || fallback;
  const online = Object.values(room.members || {}).some((member) => member?.online === true);
  if (!online) {
    // L'ultima uscita viene registrata con un timestamp del SERVER Firebase.
    // Per stanze legacy viene usata l'ultima attivita' (o la creazione).
    const lastPresence = Math.max(timestamp(room.lastPresenceAt, now), lastActivity);
    return now - lastPresence >= ROOM_EMPTY_MS ? 'empty' : null;
  }
  return now - lastActivity >= ROOM_IDLE_MS ? 'inactive' : null;
}
