import { ROLE_IDS } from './data.js';

/** Shuffle Fisher-Yates con random iniettabile per test riproducibili. */
export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Assegna i ruoli secondari senza ripetizioni e senza ripetere una coppia
 * primaria/secondaria già attribuita a un altro giocatore, anche se invertita.
 * Es: TOP + SUPPORT e SUPPORT + TOP sono la stessa coppia.
 */
export function assignSecondaries(primaryRoles, random = Math.random) {
  const secondary = [];
  const used = new Set();
  const usedPairs = new Set();
  const pairKey = (a, b) => [a, b].sort().join(':');

  function search(index) {
    if (index === primaryRoles.length) return true;
    const candidates = shuffled(
      ROLE_IDS.filter((role) => role !== primaryRoles[index]
        && !used.has(role)
        && !usedPairs.has(pairKey(primaryRoles[index], role))),
      random,
    );
    for (const role of candidates) {
      const pair = pairKey(primaryRoles[index], role);
      used.add(role);
      usedPairs.add(pair);
      secondary.push(role);
      if (search(index + 1)) return true;
      secondary.pop();
      usedPairs.delete(pair);
      used.delete(role);
    }
    return false;
  }

  if (!search(0)) throw new Error('Impossibile assegnare i ruoli secondari.');
  return secondary;
}

/**
 * Ogni giocatore riceve due ruoli diversi, prendendo le pool da UN ALTRO giocatore.
 * I prestatori formano un ciclo: nessuno pesca da sé e ogni pool viene prestata
 * esattamente una volta. I ruoli primari non si sovrappongono nella lobby.
 * Neppure le coppie di ruoli possono coincidere, a prescindere dall'ordine.
 */
export function generateDraw(activePlayers, random = Math.random) {
  if (!Array.isArray(activePlayers) || activePlayers.length < 2 || activePlayers.length > 5) {
    throw new Error('Seleziona da 2 a 5 giocatori.');
  }
  const ids = activePlayers.map((player) => player.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('I giocatori della lobby devono essere diversi.');
  }

  // Una singola permutazione ciclica evita gli abbinamenti con sé stessi.
  const donorCycle = shuffled(ids, random);
  const donors = new Map(donorCycle.map((id, index) => [
    id, donorCycle[(index + 1) % donorCycle.length],
  ]));

  const primaryRoles = shuffled(ROLE_IDS, random).slice(0, ids.length);
  const secondaryRoles = assignSecondaries(primaryRoles, random);

  return activePlayers.map((player, index) => ({
    playerId: player.id,
    donorId: donors.get(player.id),
    primary: primaryRoles[index],
    secondary: secondaryRoles[index],
  }));
}
