// Singleton de jeu + boucle + abonnement React.
import { useSyncExternalStore } from 'react';
import * as E from './game/engine';
import { setNotation } from './game/format';
import { loadLocal, newState, saveLocal, type GameState } from './game/state';

export const game: { s: GameState; offline: E.OfflineReport | null } = { s: newState(), offline: null };

let version = 0;
const subs = new Set<() => void>();
function notify(): void {
  version++;
  for (const f of subs) f();
}
export function useGame(): GameState {
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => version,
  );
  return game.s;
}

/** Exécute une action puis rafraîchit l'UI immédiatement. */
export function act<T>(f: (s: GameState) => T): T {
  const r = f(game.s);
  notify();
  return r;
}

export function replaceState(s: GameState): void {
  game.s = s;
  E.refresh(s);
  setNotation(s.settings.notation);
  saveLocal(s);
  notify();
}

let running = false;
let last = 0;
let lastUi = 0;
let lastSave = 0;

export function boot(): void {
  const loaded = loadLocal();
  if (loaded) {
    game.s = loaded;
    E.refresh(game.s);
    const elapsed = (Date.now() - loaded.lastSeen) / 1000;
    game.offline = E.applyOffline(game.s, elapsed);
  } else {
    game.s = newState();
    E.refresh(game.s);
  }
  setNotation(game.s.settings.notation);
  E.ensureQuests(game.s);
  start();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveLocal(game.s);
    } else {
      // retour au premier plan : rattrapage si l'onglet a été suspendu
      catchUp();
      last = performance.now();
      notify();
    }
  });
  window.addEventListener('pagehide', () => saveLocal(game.s));
}

function catchUp(): void {
  const elapsed = (Date.now() - game.s.lastSeen) / 1000;
  if (elapsed > 5) {
    const rep = E.applyOffline(game.s, elapsed);
    if (rep && rep.seconds >= 60) game.offline = rep;
    else if (!rep) {
      // petite absence : simulation directe
      let dt = Math.min(elapsed, 30);
      while (dt > 0) {
        const step = Math.min(dt, 0.25);
        E.tick(game.s, step);
        dt -= step;
      }
    }
  }
  game.s.lastSeen = Date.now();
}

function start(): void {
  if (running) return;
  running = true;
  last = performance.now();
  const loop = (now: number) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0) {
      if (dt > 5) {
        // onglet gelé : on traite comme une absence
        catchUp();
        dt = 0;
      }
      // sous-pas pour la stabilité
      while (dt > 0) {
        const step = Math.min(dt, 0.25);
        E.tick(game.s, step);
        dt -= step;
      }
      game.s.lastSeen = Date.now();
    }
    if (now - lastUi >= 100) {
      lastUi = now;
      notify();
    }
    if (now - lastSave >= 10000) {
      lastSave = now;
      E.ensureQuests(game.s);
      saveLocal(game.s);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // filet de sécurité quand rAF est ralenti (onglet en arrière-plan)
  setInterval(() => {
    const now = performance.now();
    if (now - last > 1000 && !document.hidden) {
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      E.tick(game.s, dt);
      notify();
    }
  }, 1000);
}

export function saveNow(): void {
  saveLocal(game.s);
}
