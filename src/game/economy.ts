// Calculs dérivés de l'économie : multiplicateurs, flux, prix, saturation.
import {
  ACH_BONUS, BUILDINGS, BUILDING_IDS, EVENTS, GOODS, GOOD_IDS, REACH_MULT, SEASONS, SEASON_LENGTH,
  UPGRADE_MAP, milestoneCount, type BuildingId, type GoodId,
} from './data';
import type { GameState, Rec } from './state';

/** Constante de temps (s) de la récupération du marché après une vente. */
export const SAT_TAU = 20;
/** Le prix ne descend jamais sous ce pourcentage du prix « frais ». */
export const SAT_FLOOR = 0.3;

export const TIER_ORDER: BuildingId[][] = (() => {
  const tiers: BuildingId[][] = [];
  for (const id of BUILDING_IDS) {
    const t = BUILDINGS[id].tier;
    (tiers[t] ||= []).push(id);
  }
  return tiers;
})();

export interface Derived {
  speed: Rec<BuildingId, number>;
  yieldM: Rec<BuildingId, number>;
  priceM: Rec<GoodId, number>;
  globalM: number;
  depth: Rec<GoodId, number>;
  demand: Rec<GoodId, number>;
  moneyMult: number;
  tapMult: number;
  tapPct: number;
  storageMult: number;
  contractMult: number;
  birdFreq: number;
  achCount: number;
  etherBonus: number;
}

export function eu(s: GameState, id: string): number {
  return s.etherUpg[id] || 0;
}

export function seasonIndex(time: number): number {
  return Math.floor(time / SEASON_LENGTH) % SEASONS.length;
}
export function seasonProgress(time: number): number {
  return (time % SEASON_LENGTH) / SEASON_LENGTH;
}

export function etherPct(s: GameState): number {
  return 0.02 + 0.01 * eu(s, 'crystal');
}

export function isActive(until: number, s: GameState): boolean {
  return until > s.time;
}

export function computeDerived(s: GameState): Derived {
  const speed = {} as Rec<BuildingId, number>;
  const yieldM = {} as Rec<BuildingId, number>;
  const priceM = {} as Rec<GoodId, number>;
  const depth = {} as Rec<GoodId, number>;
  const demand = {} as Rec<GoodId, number>;
  const fast = 1 + 0.5 * eu(s, 'fast');
  for (const id of BUILDING_IDS) {
    speed[id] = Math.pow(2, milestoneCount(s.buildings[id].n)) * fast;
    yieldM[id] = Math.pow(2, eu(s, 'yield'));
  }
  for (const g of GOOD_IDS) priceM[g] = 1;
  let globalM = 1, tapMult = 1, tapPct = 0.02, storageMult = 1, contractMult = 1, birdFreq = 1, reachM = 1;
  for (const uid in s.upgrades) {
    const u = UPGRADE_MAP[uid];
    if (!u) continue;
    const e = u.effect;
    switch (e.kind) {
      case 'yield': yieldM[e.building] *= e.mult; break;
      case 'price': priceM[e.good] *= e.mult; break;
      case 'global': globalM *= e.mult; break;
      case 'tap': tapMult *= e.mult; tapPct += e.pct; break;
      case 'storage': storageMult *= e.mult; break;
      case 'contract': contractMult *= e.mult; break;
      case 'bird': birdFreq *= e.mult; break;
      case 'reach': reachM *= e.mult; break;
    }
  }
  tapMult *= Math.pow(5, eu(s, 'tap'));
  tapPct += 0.01 * eu(s, 'tap');
  storageMult *= Math.pow(3, eu(s, 'storage'));
  contractMult *= Math.pow(2, eu(s, 'contract'));
  birdFreq *= 1 + 0.3 * eu(s, 'bird');
  reachM *= Math.pow(2, eu(s, 'diplo'));

  const season = SEASONS[seasonIndex(s.time)];
  const market = isActive(s.buffs.marketUntil, s) ? 3 : 1;
  for (const g of GOOD_IDS) {
    depth[g] = GOODS[g].depth * Math.pow(REACH_MULT, s.reach[g]) * reachM;
    let d = (season.demand[g] ?? 1) * Math.exp(s.trend[g]) * market;
    for (const ev of s.events) {
      const def = EVENTS.find((e) => e.id === ev.id);
      if (!def) continue;
      d *= (def.demand[g] ?? 1) * (def.demand.all ?? 1);
    }
    demand[g] = d;
  }

  const achCount = Object.keys(s.achievements).length;
  const etherBonus = s.ether * etherPct(s);
  let moneyMult = (1 + etherBonus) * (1 + ACH_BONUS * achCount) * globalM;
  if (isActive(s.buffs.boostUntil, s)) moneyMult *= 2;
  if (isActive(s.buffs.frenzyUntil, s)) moneyMult *= s.buffs.frenzyMult;
  if (isActive(s.buffs.stormUntil, s)) moneyMult *= 3;

  return { speed, yieldM, priceM, globalM, depth, demand, moneyMult, tapMult, tapPct, storageMult, contractMult, birdFreq, achCount, etherBonus };
}

export interface Flows {
  /** efficacité (0-1) de chaque bâtiment, limitée par les intrants */
  eff: Rec<BuildingId, number>;
  produced: Rec<GoodId, number>;
  consumed: Rec<GoodId, number>;
  /** cycles potentiels/s (pour l'affichage) */
  potential: Rec<BuildingId, number>;
}

function zeroGoods(): Rec<GoodId, number> {
  const r = {} as Rec<GoodId, number>;
  for (const g of GOOD_IDS) r[g] = 0;
  return r;
}

/**
 * Simule la production sur `dt` secondes. `stock` est modifié en place.
 * Les étages sont traités dans l'ordre : les étages supérieurs consomment
 * la production fraîche des étages inférieurs.
 */
export function runProduction(s: GameState, d: Derived, dt: number, stock: Rec<GoodId, number>): Flows {
  const eff = {} as Rec<BuildingId, number>;
  const potential = {} as Rec<BuildingId, number>;
  const produced = zeroGoods();
  const consumed = zeroGoods();
  for (const tier of TIER_ORDER) {
    if (!tier) continue;
    const cycles: Partial<Rec<BuildingId, number>> = {};
    const need = zeroGoods();
    for (const id of tier) {
      const b = BUILDINGS[id];
      const st = s.buildings[id];
      const c = st.on ? st.n * b.rate * d.speed[id] * dt : 0;
      potential[id] = st.n * b.rate * d.speed[id];
      cycles[id] = c;
      for (const g in b.inputs) need[g as GoodId] += c * (b.inputs[g as GoodId] as number);
    }
    const f = {} as Partial<Rec<GoodId, number>>;
    for (const g of GOOD_IDS) f[g] = need[g] > 0 ? Math.min(1, stock[g] / need[g]) : 1;
    for (const id of tier) {
      const b = BUILDINGS[id];
      let e = 1;
      for (const g in b.inputs) e = Math.min(e, f[g as GoodId] as number);
      if (!(e >= 0)) e = 0;
      const c = (cycles[id] as number) * e;
      eff[id] = s.buildings[id].n > 0 && s.buildings[id].on ? e : 1;
      for (const g in b.inputs) {
        const q = c * (b.inputs[g as GoodId] as number);
        stock[g as GoodId] = Math.max(0, stock[g as GoodId] - q);
        consumed[g as GoodId] += q;
      }
      const out = c * d.yieldM[id];
      stock[b.good] += out;
      produced[b.good] += out;
    }
  }
  return { eff, produced, consumed, potential };
}

/** Facteur de prix lié à la saturation actuelle. */
export function satFactor(S: number): number {
  return SAT_FLOOR + (1 - SAT_FLOOR) / (1 + S);
}

/** Prix « frais » (sans saturation) d'une unité, en $, tous bonus inclus. */
export function freshPrice(s: GameState, d: Derived, g: GoodId): number {
  void s;
  return GOODS[g].basePrice * d.demand[g] * d.priceM[g] * d.moneyMult;
}

export function unitPrice(s: GameState, d: Derived, g: GoodId): number {
  return freshPrice(s, d, g) * satFactor(s.sat[g]);
}

/** Recette (en $) pour vendre q unités en partant de la saturation S0 — intégrale exacte. */
export function saleValue(p0: number, D: number, S0: number, q: number): number {
  if (q <= 0) return 0;
  return p0 * (SAT_FLOOR * q + (1 - SAT_FLOOR) * D * Math.log((1 + S0 + q / D) / (1 + S0)));
}

export interface Steady {
  flows: Flows;
  /** unités vendues / s par bien (vente auto) */
  sold: Rec<GoodId, number>;
  /** $/s par bien */
  revenue: Rec<GoodId, number>;
  /** saturation d'équilibre par bien */
  satEq: Rec<GoodId, number>;
  income: number;
}

/** Régime permanent : ce que l'usine rapporte par seconde à l'équilibre. */
export function steadyState(s: GameState, d: Derived): Steady {
  const stock = zeroGoods();
  const flows = runProduction(s, d, 1, stock);
  const sold = zeroGoods();
  const revenue = zeroGoods();
  const satEq = zeroGoods();
  let income = 0;
  for (const g of GOOD_IDS) {
    const r = stock[g];
    if (!s.autoSell[g] || r <= 0) continue;
    const S = (r * SAT_TAU) / d.depth[g];
    sold[g] = r;
    satEq[g] = S;
    revenue[g] = r * freshPrice(s, d, g) * satFactor(S);
    income += revenue[g];
  }
  return { flows, sold, revenue, satEq, income };
}

export function storageCap(_s: GameState, d: Derived, g: GoodId, flows: Flows): number {
  return Math.max(250, flows.produced[g] * 180 * d.storageMult);
}

// ─── Coûts ──────────────────────────────────────────────────
export function buildingCost(id: BuildingId, owned: number, qty: number): number {
  const b = BUILDINGS[id];
  const r = b.growth;
  return (b.baseCost * Math.pow(r, owned) * (Math.pow(r, qty) - 1)) / (r - 1);
}

export function maxAffordable(id: BuildingId, owned: number, money: number): number {
  const b = BUILDINGS[id];
  const r = b.growth;
  const first = b.baseCost * Math.pow(r, owned);
  if (money < first) return 0;
  return Math.floor(Math.log((money * (r - 1)) / first + 1) / Math.log(r));
}

export function isBuildingVisible(s: GameState, id: BuildingId): boolean {
  const idx = BUILDING_IDS.indexOf(id);
  if (idx === 0 || s.buildings[id].n > 0) return true;
  const prev = BUILDING_IDS[idx - 1];
  return s.buildings[prev].n > 0;
}

export function isGoodUnlocked(s: GameState, g: GoodId): boolean {
  for (const id of BUILDING_IDS) if (BUILDINGS[id].good === g && s.buildings[id].n > 0) return true;
  return false;
}
