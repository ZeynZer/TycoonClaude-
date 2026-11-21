import { BUILDING_IDS, GOOD_IDS, type BuildingId, type GoodId } from './data';

export const SAVE_VERSION = 1;

export type Rec<K extends string, V> = Record<K, V>;

export interface Contract {
  id: number;
  client: string;
  good: GoodId;
  qty: number;
  filled: number;
  reward: number;
  grelons: number;
  duration: number;
  /** temps de jeu (s) où le contrat expire ; 0 = offre non acceptée */
  deadline: number;
  accepted: boolean;
  /** offre disparaît à ce temps si non acceptée */
  offerUntil: number;
}

export interface ActiveEvent {
  id: string;
  until: number;
}

export interface Quest {
  kind: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface GameState {
  v: number;
  money: number;
  /** Gains de la partie en cours */
  runEarned: number;
  /** Gains depuis toujours (sert au calcul de l'éther) */
  totalEarned: number;
  ether: number;
  etherClaimed: number;
  grelons: number;
  buildings: Rec<BuildingId, { n: number; on: boolean }>;
  stock: Rec<GoodId, number>;
  autoSell: Rec<GoodId, boolean>;
  sat: Rec<GoodId, number>;
  reach: Rec<GoodId, number>;
  trend: Rec<GoodId, number>;
  hist: Rec<GoodId, number[]>;
  upgrades: Record<string, true>;
  etherUpg: Record<string, number>;
  achievements: Record<string, number>;
  /** temps de jeu total en secondes (avance aussi hors-ligne) */
  time: number;
  runTime: number;
  histClock: number;
  events: ActiveEvent[];
  nextEventAt: number;
  nextEventId: string;
  contracts: Contract[];
  nextContractId: number;
  nextContractAt: number;
  buffs: { frenzyUntil: number; frenzyMult: number; marketUntil: number; boostUntil: number; stormUntil: number };
  pressure: number;
  lastTapAt: number;
  bird: { nextAt: number; activeUntil: number; spawnedAt: number; y: number };
  stats: {
    taps: number;
    birds: number;
    contracts: number;
    prestiges: number;
    storms: number;
    maxIncome: number;
    bought: number;
    bestRun: number;
    played: number;
  };
  daily: { lastClaim: string; streak: number; questDay: string; quests: Quest[] };
  settings: { sound: boolean; haptics: boolean; notation: 'short' | 'sci'; name: string; tutorial: number };
  lastSeen: number;
  cloud: { id: string; secret: string } | null;
}

function recOf<K extends string, V>(keys: readonly K[], f: (k: K) => V): Rec<K, V> {
  const r = {} as Rec<K, V>;
  for (const k of keys) r[k] = f(k);
  return r;
}

export function newState(): GameState {
  return {
    v: SAVE_VERSION,
    money: 15,
    runEarned: 0,
    totalEarned: 0,
    ether: 0,
    etherClaimed: 0,
    grelons: 5,
    buildings: recOf(BUILDING_IDS, () => ({ n: 0, on: true })),
    stock: recOf(GOOD_IDS, () => 0),
    autoSell: recOf(GOOD_IDS, () => true),
    sat: recOf(GOOD_IDS, () => 0),
    reach: recOf(GOOD_IDS, () => 0),
    trend: recOf(GOOD_IDS, () => 0),
    hist: recOf(GOOD_IDS, () => [] as number[]),
    upgrades: {},
    etherUpg: {},
    achievements: {},
    time: 0,
    runTime: 0,
    histClock: 0,
    events: [],
    nextEventAt: 90,
    nextEventId: '',
    contracts: [],
    nextContractId: 1,
    nextContractAt: 45,
    buffs: { frenzyUntil: 0, frenzyMult: 1, marketUntil: 0, boostUntil: 0, stormUntil: 0 },
    pressure: 0,
    lastTapAt: -10,
    bird: { nextAt: 75, activeUntil: 0, spawnedAt: 0, y: 0.3 },
    stats: { taps: 0, birds: 0, contracts: 0, prestiges: 0, storms: 0, maxIncome: 0, bought: 0, bestRun: 0, played: 0 },
    daily: { lastClaim: '', streak: 0, questDay: '', quests: [] },
    settings: { sound: true, haptics: true, notation: 'short', name: '', tutorial: 0 },
    lastSeen: Date.now(),
    cloud: null,
  };
}

/** Fusionne profondément une sauvegarde avec l'état par défaut (tolérant aux versions). */
export function hydrate(raw: unknown): GameState {
  const base = newState();
  if (!raw || typeof raw !== 'object') return base;
  const merge = (a: any, b: any): any => {
    if (b === undefined || b === null) return a;
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (typeof a === 'object' && a !== null) {
      if (typeof b !== 'object') return a;
      const out: any = { ...b };
      for (const k of Object.keys(a)) out[k] = merge(a[k], b[k]);
      return out;
    }
    if (typeof a === 'number') return typeof b === 'number' && Number.isFinite(b) ? b : a;
    return typeof b === typeof a ? b : a;
  };
  const s = merge(base, raw) as GameState;
  // `upgrades`, `etherUpg`, `achievements` sont des dictionnaires libres
  const r = raw as any;
  if (r.upgrades && typeof r.upgrades === 'object') s.upgrades = { ...r.upgrades };
  if (r.etherUpg && typeof r.etherUpg === 'object') s.etherUpg = { ...r.etherUpg };
  if (r.achievements && typeof r.achievements === 'object') s.achievements = { ...r.achievements };
  if (r.cloud && typeof r.cloud.id === 'string') s.cloud = { id: r.cloud.id, secret: String(r.cloud.secret) };
  s.v = SAVE_VERSION;
  return s;
}

const KEY = 'stratos-save-v1';

export function saveLocal(s: GameState): void {
  try {
    s.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou indisponible */
  }
}

export function loadLocal(): GameState | null {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return null;
    return hydrate(JSON.parse(txt));
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  localStorage.removeItem(KEY);
}

export function exportSave(s: GameState): string {
  const json = JSON.stringify(s);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(code: string): GameState {
  const json = decodeURIComponent(escape(atob(code.trim())));
  return hydrate(JSON.parse(json));
}
