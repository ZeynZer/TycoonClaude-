// Simulation d'équilibrage : un bot glouton joue N heures et on observe la progression.
// Usage : npx tsx scripts/simulate.ts [heures] [actif=1|0]
import { BUILDING_IDS, GOOD_IDS, UPGRADES, reachCost, ETHER_UPGRADES } from '../src/game/data';
import { computeDerived, steadyState, buildingCost } from '../src/game/economy';
import * as E from '../src/game/engine';
import { newState, type GameState } from '../src/game/state';
import { fmt } from '../src/game/format';

const hours = Number(process.argv[2] ?? 6);
const active = (process.argv[3] ?? '1') === '1';
let seed = 12345;
E.setRng(() => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296));

let s: GameState = newState();
const income = (st: GameState) => steadyState(st, computeDerived(st)).income;

type Cand = { label: string; cost: number; apply: () => void; undo: () => void; buy: () => boolean };

function candidates(st: GameState): Cand[] {
  const out: Cand[] = [];
  for (const id of BUILDING_IDS) {
    if (!E.snapshot(st) || (BUILDING_IDS.indexOf(id) > 0 && st.buildings[BUILDING_IDS[BUILDING_IDS.indexOf(id) - 1]].n === 0 && st.buildings[id].n === 0)) continue;
    out.push({
      label: id, cost: buildingCost(id, st.buildings[id].n, 1),
      apply: () => { st.buildings[id].n++; }, undo: () => { st.buildings[id].n--; },
      buy: () => E.buyBuilding(st, id, 1),
    });
  }
  for (const u of UPGRADES) {
    if (!E.upgradeAvailable(st, u.id)) continue;
    out.push({ label: u.id, cost: u.cost, apply: () => { st.upgrades[u.id] = true; }, undo: () => { delete st.upgrades[u.id]; }, buy: () => E.buyUpgrade(st, u.id) });
  }
  for (const g of GOOD_IDS) {
    out.push({ label: 'reach_' + g, cost: reachCost(g, st.reach[g]), apply: () => { st.reach[g]++; }, undo: () => { st.reach[g]--; }, buy: () => E.buyReach(st, g) });
  }
  return out;
}

function botBuy(st: GameState): void {
  for (let guard = 0; guard < 40; guard++) {
    const base = income(st);
    let best: Cand | null = null;
    let bestScore = Infinity;
    for (const c of candidates(st)) {
      c.apply();
      const gain = income(st) - base;
      c.undo();
      if (gain <= 0) continue;
      const wait = Math.max(0, c.cost - st.money) / Math.max(base, 1e-9);
      const score = c.cost / gain + wait;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (!best || best.cost > st.money) return;
    best.buy();
  }
}

const DT = 1;
const firstBuy: Record<string, number> = {};
let lastReport = -1;
let prestiges = 0;
const t0 = Date.now();
for (let t = 0; t < hours * 3600; t += DT) {
  E.tick(s, DT);
  if (active) {
    for (let i = 0; i < 3; i++) E.tap(s);
    if (s.bird.activeUntil > 0 && s.time - s.bird.spawnedAt > 2) E.catchBird(s);
    for (const c of s.contracts) if (!c.accepted && s.contracts.filter((x) => x.accepted).length < 2) E.acceptContract(s, c.id);
  }
  if (t % 2 === 0) botBuy(s);
  for (const b of BUILDING_IDS) if (s.buildings[b].n > 0 && firstBuy[b] === undefined) { firstBuy[b] = t; console.log(`  🏗️ ${b} @${(t/60).toFixed(1)}min`); }
  const gain = E.prestigeGain(s);
  if (gain >= Math.max(20, s.etherClaimed * 1.2) && s.runTime > 600) {
    console.log(`  ✨ PRESTIGE @${(t / 60).toFixed(0)}min  +${gain} éther (total ${s.etherClaimed + gain})  run=${(s.runTime / 60).toFixed(0)}min`);
    s = E.prestige(s);
    prestiges++;
    // dépense d'éther simple : niveaux bon marché en priorité, garde 60 %
    for (let k = 0; k < 20; k++) {
      const opts = ETHER_UPGRADES.filter((u) => (s.etherUpg[u.id] || 0) < u.max && u.id !== 'auto')
        .map((u) => ({ u, c: Math.ceil(u.cost(s.etherUpg[u.id] || 0)) }))
        .sort((a, b) => a.c - b.c);
      if (!opts.length || opts[0].c > s.ether * 0.15) break;
      E.buyEtherUpgrade(s, opts[0].u.id);
    }
  }
  const slot = Math.floor(t / 600);
  if (slot !== lastReport) {
    lastReport = slot;
    const inc = income(s);
    const bs = BUILDING_IDS.map((b) => `${b}:${s.buildings[b].n}`).join(' ');
    const sats = GOOD_IDS.filter((g) => s.autoSell[g]).map((g) => s.reach[g]).join(',');
    console.log(`${String(t / 60).padStart(4)}min  $${fmt(s.money).padStart(8)}  ${fmt(inc).padStart(8)}/s  up=${Object.keys(s.upgrades).length} ach=${Object.keys(s.achievements).length} éther=${s.ether} gain=${E.prestigeGain(s)} reach=[${sats}]  ${bs}`);
  }
}
console.log(`prestiges=${prestiges}  sim=${((Date.now() - t0) / 1000).toFixed(1)}s`);
