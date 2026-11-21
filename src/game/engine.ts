// Boucle de jeu et actions du joueur.
import {
  ACHIEVEMENTS, MILESTONES, BUILDINGS, BUILDING_IDS, CLIENT_NAMES, DAILY_REWARDS, ETHER_UPGRADE_MAP, EVENTS, GOODS, GOOD_IDS,
  QUEST_TEMPLATES, SHOP, UPGRADES, UPGRADE_MAP, etherFor, reachCost, type AchCond, type BuildingId, type GoodId,
  type QuestKind,
} from './data';
import {
  SAT_TAU, buildingCost, computeDerived, eu, freshPrice, isGoodUnlocked, maxAffordable, runProduction, saleValue,
  satFactor, steadyState, storageCap, type Derived, type Steady,
} from './economy';
import { newState, type Contract, type GameState } from './state';

// ─── Bus d'événements (UI : sons, toasts, particules) ───────
export type GameEvent =
  | { type: 'achievement'; id: string }
  | { type: 'milestone'; building: BuildingId; n: number }
  | { type: 'contractDone'; contract: Contract }
  | { type: 'contractFail'; contract: Contract }
  | { type: 'contractNew' }
  | { type: 'event'; id: string }
  | { type: 'bird' }
  | { type: 'birdReward'; kind: string; amount: number }
  | { type: 'storm' }
  | { type: 'toast'; text: string; emoji?: string };

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();
export function onGameEvent(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit(e: GameEvent): void {
  for (const l of listeners) l(e);
}

export let rng: () => number = Math.random;
export function setRng(f: () => number): void {
  rng = f;
}
const rand = (a: number, b: number) => a + rng() * (b - a);
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Cache du régime permanent (recalculé à chaque tick) ────
export interface Snapshot {
  d: Derived;
  steady: Steady;
}
let snap: Snapshot | null = null;
export function snapshot(s: GameState): Snapshot {
  if (!snap) refresh(s);
  return snap as Snapshot;
}
export function refresh(s: GameState): Snapshot {
  const d = computeDerived(s);
  snap = { d, steady: steadyState(s, d) };
  return snap;
}
/** Revenu/s « de base » (hors buffs temporaires) — sert aux récompenses. */
export function baseIncome(s: GameState): number {
  const { d, steady } = snapshot(s);
  const buffMult = d.moneyMult / ((1 + d.etherBonus) * (1 + 0.02 * d.achCount) * d.globalM);
  return steady.income / Math.max(1, buffMult);
}

// ─── Gains ──────────────────────────────────────────────────
function earn(s: GameState, amount: number): void {
  if (!(amount > 0)) return;
  s.money += amount;
  s.runEarned += amount;
  s.totalEarned += amount;
}

let achTimer = 0;
let autoTimer = 0;

export function tick(s: GameState, dt: number): void {
  if (dt <= 0) return;
  s.time += dt;
  s.runTime += dt;
  s.stats.played += dt;

  // Événements de marché
  if (s.events.some((e) => e.until <= s.time)) s.events = s.events.filter((e) => e.until > s.time);
  if (!s.nextEventId) s.nextEventId = pickEvent();
  if (s.time >= s.nextEventAt) {
    const def = EVENTS.find((e) => e.id === s.nextEventId) ?? EVENTS[0];
    s.events.push({ id: def.id, until: s.time + def.duration });
    emit({ type: 'event', id: def.id });
    s.nextEventAt = s.time + rand(80, 170);
    s.nextEventId = pickEvent(def.id);
  }

  // Tendances : processus d'Ornstein-Uhlenbeck dans l'espace log
  const k = Math.sqrt(dt);
  for (const g of GOOD_IDS) {
    s.trend[g] += -s.trend[g] * (dt / 140) + 0.035 * k * gauss();
    if (s.trend[g] > 0.45) s.trend[g] = 0.45;
    if (s.trend[g] < -0.45) s.trend[g] = -0.45;
    s.sat[g] *= Math.exp(-dt / SAT_TAU);
  }

  const d = computeDerived(s);
  const flows = runProduction(s, d, dt, s.stock);

  // Contrats acceptés : prioritaires sur la vente
  for (const c of s.contracts) {
    if (!c.accepted) continue;
    const take = Math.min(s.stock[c.good], c.qty - c.filled);
    if (take > 0) {
      s.stock[c.good] -= take;
      c.filled += take;
    }
    if (c.filled >= c.qty - 1e-9) completeContract(s, c);
  }
  s.contracts = s.contracts.filter((c) => {
    if (c.filled >= c.qty - 1e-9 && c.accepted) return false;
    if (c.accepted && s.time > c.deadline) {
      emit({ type: 'contractFail', contract: c });
      return false;
    }
    if (!c.accepted && s.time > c.offerUntil) return false;
    return true;
  });

  // Vente automatique + plafond de stockage
  for (const g of GOOD_IDS) {
    if (s.autoSell[g] && s.stock[g] > 0) {
      sellRaw(s, d, g, s.stock[g]);
    } else {
      const cap = storageCap(s, d, g, flows);
      if (s.stock[g] > cap) s.stock[g] = cap;
    }
  }

  // Historique des prix (toutes les 5 s)
  s.histClock += dt;
  if (s.histClock >= 5) {
    s.histClock = 0;
    for (const g of GOOD_IDS) {
      const h = s.hist[g];
      h.push(GOODS[g].basePrice * d.demand[g] * satFactor(s.sat[g]));
      if (h.length > 60) h.shift();
    }
  }

  // Oiseau-tonnerre
  if (s.bird.activeUntil > 0 && s.time > s.bird.activeUntil) {
    s.bird.activeUntil = 0;
    scheduleBird(s, d);
  } else if (s.bird.activeUntil === 0 && s.time >= s.bird.nextAt) {
    spawnBird(s);
  }

  // Offres de contrats
  if (s.time >= s.nextContractAt) {
    s.nextContractAt = s.time + rand(25, 50);
    if (s.contracts.length < 3) {
      const c = makeContract(s, d);
      if (c) {
        s.contracts.push(c);
        emit({ type: 'contractNew' });
      }
    }
  }

  // Pression (jauge de tap)
  if (s.time - s.lastTapAt > 1.5 && s.pressure > 0) s.pressure = Math.max(0, s.pressure - dt * 4);

  const sn = refresh(s);
  if (sn.steady.income > s.stats.maxIncome) s.stats.maxIncome = sn.steady.income;

  achTimer += dt;
  if (achTimer >= 1) {
    achTimer = 0;
    checkAchievements(s);
  }
  if (eu(s, 'auto') > 0) {
    autoTimer += dt;
    if (autoTimer >= 1) {
      autoTimer = 0;
      autoBuy(s);
    }
  }
}

function pickEvent(exclude?: string): string {
  const pool = EVENTS.filter((e) => e.id !== exclude);
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let r = rng() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e.id;
  }
  return pool[0].id;
}

function sellRaw(s: GameState, d: Derived, g: GoodId, q: number): number {
  const p0 = freshPrice(s, d, g);
  const D = d.depth[g];
  const v = saleValue(p0, D, s.sat[g], q);
  s.sat[g] += q / D;
  s.stock[g] -= q;
  if (s.stock[g] < 1e-9) s.stock[g] = 0;
  earn(s, v);
  return v;
}

// ─── Hors-ligne ─────────────────────────────────────────────
export interface OfflineReport {
  seconds: number;
  money: number;
  efficiency: number;
}
export function offlineCapSeconds(s: GameState): number {
  return (2 + 4 * eu(s, 'offline')) * 3600;
}
export function offlineEfficiency(s: GameState): number {
  return Math.min(1, 0.5 + 0.1 * eu(s, 'offline'));
}

export function applyOffline(s: GameState, elapsed: number): OfflineReport | null {
  if (elapsed < 30) return null;
  const secs = Math.min(elapsed, offlineCapSeconds(s));
  const eff = offlineEfficiency(s);
  // les bonus temporaires ne comptent pas hors-ligne
  const savedBuffs = { ...s.buffs };
  s.buffs.frenzyUntil = 0;
  s.buffs.stormUntil = 0;
  s.buffs.marketUntil = 0;
  const boostLeft = Math.max(0, s.buffs.boostUntil - s.time);
  s.buffs.boostUntil = 0;
  const { steady, d } = refresh(s);
  const boosted = Math.min(secs, boostLeft);
  const money = steady.income * eff * (secs + boosted);
  earn(s, money);
  for (const g of GOOD_IDS) {
    if (!s.autoSell[g]) {
      const net = steady.flows.produced[g] - steady.flows.consumed[g];
      if (net > 0) s.stock[g] = Math.min(storageCap(s, d, g, steady.flows), s.stock[g] + net * secs * eff);
    }
    s.sat[g] = steady.satEq[g] || 0;
  }
  s.buffs = savedBuffs;
  // le temps du monde avance (saisons, durées)
  const shift = secs;
  s.time += shift;
  s.stats.played += shift;
  s.runTime += shift;
  s.events = s.events.filter((e) => e.until > s.time);
  if (s.nextEventAt < s.time) s.nextEventAt = s.time + rand(20, 60);
  if (s.bird.nextAt < s.time) s.bird.nextAt = s.time + rand(10, 40);
  s.bird.activeUntil = 0;
  s.contracts = s.contracts.filter((c) => {
    if (c.accepted) {
      if (s.time > c.deadline) return false;
      return true;
    }
    return s.time <= c.offerUntil;
  });
  // le turbo s'écoule pendant l'absence
  if (s.buffs.boostUntil > 0) s.buffs.boostUntil = Math.max(0, s.buffs.boostUntil);
  refresh(s);
  return { seconds: secs, money, efficiency: eff };
}

// ─── Bâtiments ──────────────────────────────────────────────
export type BuyQty = 1 | 10 | 100 | 'max';

export function quoteBuilding(s: GameState, id: BuildingId, q: BuyQty): { qty: number; cost: number } {
  const n = s.buildings[id].n;
  if (q === 'max') {
    const m = maxAffordable(id, n, s.money);
    const qty = Math.max(1, m);
    return { qty, cost: buildingCost(id, n, qty) };
  }
  return { qty: q, cost: buildingCost(id, n, q) };
}

export function buyBuilding(s: GameState, id: BuildingId, q: BuyQty): boolean {
  const { qty, cost } = quoteBuilding(s, id, q);
  if (cost > s.money || qty <= 0) return false;
  const before = s.buildings[id].n;
  s.money -= cost;
  s.buildings[id].n += qty;
  s.stats.bought += qty;
  questProgress(s, 'buy', qty);
  const after = s.buildings[id].n;
  for (const m of MILESTONES) {
    if (before < m && after >= m) emit({ type: 'milestone', building: id, n: m });
  }
  refresh(s);
  return true;
}

export function toggleBuilding(s: GameState, id: BuildingId): void {
  s.buildings[id].on = !s.buildings[id].on;
  refresh(s);
}

// ─── Améliorations ──────────────────────────────────────────
export function upgradeAvailable(s: GameState, id: string): boolean {
  const u = UPGRADE_MAP[id];
  if (!u || s.upgrades[id]) return false;
  if (u.req.building && s.buildings[u.req.building].n < (u.req.count ?? 0)) return false;
  if (u.req.earned && s.runEarned + s.money < u.req.earned && s.totalEarned < u.req.earned * 50) return false;
  return true;
}

export function buyUpgrade(s: GameState, id: string): boolean {
  const u = UPGRADE_MAP[id];
  if (!u || !upgradeAvailable(s, id) || s.money < u.cost) return false;
  s.money -= u.cost;
  s.upgrades[id] = true;
  refresh(s);
  return true;
}

function autoBuy(s: GameState): void {
  for (const u of UPGRADES) {
    if (u.cost > s.money * 0.1) break;
    if (upgradeAvailable(s, u.id)) buyUpgrade(s, u.id);
  }
}

// ─── Marché ─────────────────────────────────────────────────
export function buyReach(s: GameState, g: GoodId): boolean {
  const c = reachCost(g, s.reach[g]);
  if (s.money < c) return false;
  s.money -= c;
  s.reach[g]++;
  refresh(s);
  return true;
}

export function sellStock(s: GameState, g: GoodId, fraction = 1): number {
  const q = s.stock[g] * fraction;
  if (q <= 0) return 0;
  const { d } = snapshot(s);
  const ratio = d.demand[g] * satFactor(s.sat[g]);
  const v = sellRaw(s, d, g, q);
  if (ratio >= 1.2) questProgress(s, 'sell', 1);
  refresh(s);
  return v;
}

export function previewSale(s: GameState, g: GoodId, q: number): number {
  const { d } = snapshot(s);
  return saleValue(freshPrice(s, d, g), d.depth[g], s.sat[g], q);
}

export function toggleAutoSell(s: GameState, g: GoodId): void {
  s.autoSell[g] = !s.autoSell[g];
  refresh(s);
}

// ─── Tap & tempête ──────────────────────────────────────────
export function pressureNeeded(s: GameState): number {
  return Math.round(60 * (1 - 0.2 * eu(s, 'storm')));
}

export function tapValue(s: GameState): number {
  const { d } = snapshot(s);
  return (d.tapMult + baseIncome(s) * d.tapPct) * (s.buffs.stormUntil > s.time ? 3 : 1);
}

export function tap(s: GameState): { value: number; crit: boolean; storm: boolean } {
  const crit = rng() < 0.06;
  const value = tapValue(s) * (crit ? 8 : 1);
  earn(s, value);
  s.stats.taps++;
  s.lastTapAt = s.time;
  questProgress(s, 'taps', 1);
  let storm = false;
  if (s.buffs.stormUntil <= s.time) {
    s.pressure += crit ? 3 : 1;
    if (s.pressure >= pressureNeeded(s)) {
      s.pressure = 0;
      s.buffs.stormUntil = s.time + 15 + 5 * eu(s, 'storm');
      s.stats.storms++;
      questProgress(s, 'storms', 1);
      storm = true;
      emit({ type: 'storm' });
      refresh(s);
    }
  }
  return { value, crit, storm };
}

// ─── Oiseau-tonnerre ────────────────────────────────────────
function scheduleBird(s: GameState, d: Derived): void {
  s.bird.nextAt = s.time + rand(110, 260) / d.birdFreq;
}
function spawnBird(s: GameState): void {
  s.bird.activeUntil = s.time + 13;
  s.bird.spawnedAt = s.time;
  s.bird.y = rand(0.12, 0.6);
  emit({ type: 'bird' });
}
export function summonBird(s: GameState): void {
  if (s.bird.activeUntil === 0) spawnBird(s);
}

export function catchBird(s: GameState): { kind: string; amount: number } | null {
  if (s.bird.activeUntil === 0 || s.time > s.bird.activeUntil) return null;
  s.bird.activeUntil = 0;
  const { d } = snapshot(s);
  scheduleBird(s, d);
  s.stats.birds++;
  questProgress(s, 'birds', 1);
  const power = 1 + 0.25 * eu(s, 'bird');
  const r = rng();
  let res: { kind: string; amount: number };
  if (r < 0.4) {
    s.buffs.frenzyMult = 7;
    s.buffs.frenzyUntil = s.time + 30 * power;
    res = { kind: 'frenzy', amount: 7 };
  } else if (r < 0.72) {
    const amount = (Math.min(s.money * 0.2, baseIncome(s) * 900) + 25) * power;
    earn(s, amount);
    res = { kind: 'cash', amount };
  } else if (r < 0.92) {
    s.buffs.marketUntil = s.time + 25 * power;
    for (const g of GOOD_IDS) s.sat[g] = 0;
    res = { kind: 'market', amount: 3 };
  } else {
    const amount = Math.round((2 + Math.floor(rng() * 3)) * power);
    s.grelons += amount;
    res = { kind: 'grelons', amount };
  }
  refresh(s);
  emit({ type: 'birdReward', ...res });
  return res;
}

// ─── Contrats ───────────────────────────────────────────────
function makeContract(s: GameState, d: Derived): Contract | null {
  const { steady } = snapshot(s);
  const goods = GOOD_IDS.filter((g) => isGoodUnlocked(s, g) && steady.flows.produced[g] > 0);
  if (!goods.length) return null;
  // préférence pour les biens de haut niveau
  const weights = goods.map((g) => 1 + GOOD_IDS.indexOf(g) * 0.6);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let g = goods[0];
  for (let i = 0; i < goods.length; i++) {
    r -= weights[i];
    if (r <= 0) { g = goods[i]; break; }
  }
  const rate = steady.flows.produced[g] - steady.flows.consumed[g] * 0.5;
  const prodRate = Math.max(rate, steady.flows.produced[g] * 0.3);
  const fillSecs = rand(45, 140);
  const qty = niceRound(Math.max(5, prodRate * fillSecs));
  const duration = Math.round(Math.min(900, Math.max(150, (qty / prodRate) * rand(2.2, 3.5))));
  const p0 = GOODS[g].basePrice * d.priceM[g] * d.moneyMult / (s.buffs.boostUntil > s.time ? 2 : 1);
  const reward = (qty * p0 * rand(3, 4.5) + baseIncome(s) * rand(20, 50)) * d.contractMult;
  const names = CLIENT_NAMES[g];
  return {
    id: s.nextContractId++,
    client: names[Math.floor(rng() * names.length)],
    good: g,
    qty,
    filled: 0,
    reward,
    grelons: rng() < 0.22 ? 1 + Math.floor(rng() * 3) : 0,
    duration,
    deadline: 0,
    accepted: false,
    offerUntil: s.time + 150,
  };
}

function niceRound(x: number): number {
  if (x < 10) return Math.ceil(x);
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.ceil(x / p) * p;
}

export function acceptContract(s: GameState, id: number): void {
  const c = s.contracts.find((x) => x.id === id);
  if (!c || c.accepted) return;
  if (s.contracts.filter((x) => x.accepted).length >= 2) {
    emit({ type: 'toast', text: 'Maximum 2 contrats actifs à la fois', emoji: '📜' });
    return;
  }
  c.accepted = true;
  c.deadline = s.time + c.duration;
}

export function declineContract(s: GameState, id: number): void {
  s.contracts = s.contracts.filter((x) => x.id !== id);
}

function completeContract(s: GameState, c: Contract): void {
  earn(s, c.reward);
  s.grelons += c.grelons;
  s.stats.contracts++;
  questProgress(s, 'contracts', 1);
  emit({ type: 'contractDone', contract: c });
}

export function rerollContracts(s: GameState): void {
  const { d } = snapshot(s);
  s.contracts = s.contracts.filter((c) => c.accepted);
  while (s.contracts.length < 3) {
    const c = makeContract(s, d);
    if (!c) break;
    s.contracts.push(c);
  }
}

// ─── Prestige ───────────────────────────────────────────────
export function prestigeGain(s: GameState): number {
  return Math.max(0, etherFor(s.totalEarned) - s.etherClaimed);
}

export function prestige(s: GameState): GameState {
  const gain = prestigeGain(s);
  const fresh = newState();
  fresh.ether = s.ether + gain;
  fresh.etherClaimed = s.etherClaimed + gain;
  fresh.totalEarned = s.totalEarned;
  fresh.grelons = s.grelons;
  fresh.etherUpg = { ...s.etherUpg };
  fresh.achievements = { ...s.achievements };
  fresh.stats = { ...s.stats, prestiges: s.stats.prestiges + 1, bestRun: Math.max(s.stats.bestRun, s.runEarned) };
  fresh.daily = s.daily;
  fresh.settings = s.settings;
  fresh.cloud = s.cloud;
  fresh.time = s.time;
  fresh.nextEventAt = s.time + 60;
  fresh.nextContractAt = s.time + 30;
  fresh.bird.nextAt = s.time + 60;
  fresh.buffs.boostUntil = s.buffs.boostUntil;
  const kit = eu(s, 'kit');
  fresh.buildings.evap.n = 10 * kit;
  fresh.buildings.cond.n = 5 * kit;
  fresh.money = eu(s, 'seed') > 0 ? 1000 * Math.pow(30, eu(s, 'seed') - 1) : 15;
  const rs = 2 * eu(s, 'reachstart');
  for (const g of GOOD_IDS) fresh.reach[g] = rs;
  refresh(fresh);
  return fresh;
}

export function buyEtherUpgrade(s: GameState, id: string): boolean {
  const u = ETHER_UPGRADE_MAP[id];
  if (!u) return false;
  const lvl = eu(s, id);
  if (lvl >= u.max) return false;
  const cost = Math.ceil(u.cost(lvl));
  if (s.ether < cost) return false;
  s.ether -= cost;
  s.etherUpg[id] = lvl + 1;
  refresh(s);
  return true;
}

// ─── Boutique grêlons ───────────────────────────────────────
export function buyShop(s: GameState, id: string): boolean {
  const item = SHOP.find((x) => x.id === id);
  if (!item || s.grelons < item.cost) return false;
  if (id === 'bird' && s.bird.activeUntil > 0) return false;
  s.grelons -= item.cost;
  switch (id) {
    case 'boost30': addBoost(s, 30 * 60); break;
    case 'warp1': earn(s, baseIncome(s) * 3600); break;
    case 'warp8': earn(s, baseIncome(s) * 3600 * 8); break;
    case 'bird': summonBird(s); break;
    case 'reroll': rerollContracts(s); break;
  }
  refresh(s);
  return true;
}

function addBoost(s: GameState, secs: number): void {
  s.buffs.boostUntil = Math.max(s.buffs.boostUntil, s.time) + secs;
}

// ─── Quotidien ──────────────────────────────────────────────
export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function canClaimDaily(s: GameState): boolean {
  return s.daily.lastClaim !== dayKey();
}
export function nextDailyIndex(s: GameState): number {
  const streak = s.daily.lastClaim === yesterdayKey() || s.daily.lastClaim === dayKey() ? s.daily.streak : 0;
  return streak % DAILY_REWARDS.length;
}
export function claimDaily(s: GameState): boolean {
  if (!canClaimDaily(s)) return false;
  const streak = s.daily.lastClaim === yesterdayKey() ? s.daily.streak + 1 : 1;
  const r = DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length];
  s.daily.streak = streak;
  s.daily.lastClaim = dayKey();
  s.grelons += r.grelons;
  if (r.boostMin) addBoost(s, r.boostMin * 60);
  refresh(s);
  return true;
}

export function ensureQuests(s: GameState): void {
  const today = dayKey();
  if (s.daily.questDay === today && s.daily.quests.length) return;
  const pool = [...QUEST_TEMPLATES];
  const quests = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const tier = Math.floor(rng() * t.amounts.length);
    quests.push({ kind: t.kind, target: t.amounts[tier], progress: 0, reward: t.reward + tier * 2, claimed: false });
  }
  s.daily.quests = quests;
  s.daily.questDay = today;
}

function questProgress(s: GameState, kind: QuestKind, n: number): void {
  for (const q of s.daily.quests) if (q.kind === kind && !q.claimed) q.progress = Math.min(q.target, q.progress + n);
}

export function claimQuest(s: GameState, i: number): boolean {
  const q = s.daily.quests[i];
  if (!q || q.claimed || q.progress < q.target) return false;
  q.claimed = true;
  s.grelons += q.reward;
  return true;
}

// ─── Succès ─────────────────────────────────────────────────
function achValue(s: GameState, c: AchCond): number {
  switch (c.kind) {
    case 'building': return s.buildings[c.building].n;
    case 'earned': return s.totalEarned;
    case 'taps': return s.stats.taps;
    case 'birds': return s.stats.birds;
    case 'contracts': return s.stats.contracts;
    case 'prestiges': return s.stats.prestiges;
    case 'ether': return s.etherClaimed;
    case 'income': return s.stats.maxIncome;
    case 'storms': return s.stats.storms;
    case 'allBuildings': return Math.min(...BUILDING_IDS.map((b) => s.buildings[b].n));
    case 'reach': return GOOD_IDS.reduce((a, g) => a + s.reach[g], 0);
  }
}
export function achProgress(s: GameState, c: AchCond): number {
  return Math.min(1, achValue(s, c) / c.n);
}

export function checkAchievements(s: GameState): void {
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (achValue(s, a.cond) >= a.cond.n) {
      s.achievements[a.id] = Date.now();
      s.grelons += a.reward;
      changed = true;
      emit({ type: 'achievement', id: a.id });
    }
  }
  if (changed) refresh(s);
}

// ─── Aides UI ───────────────────────────────────────────────
export function buildingRateInfo(s: GameState, id: BuildingId) {
  const { d, steady } = snapshot(s);
  const b = BUILDINGS[id];
  const n = s.buildings[id].n;
  const eff = steady.flows.eff[id] ?? 1;
  const perUnit = b.rate * d.speed[id] * d.yieldM[id];
  const on = s.buildings[id].on ? 1 : 0;
  const cycles = b.rate * d.speed[id] * n * eff * on;
  return { perUnit, total: perUnit * n * eff * on, cycles, eff, speed: d.speed[id], yieldM: d.yieldM[id] };
}
