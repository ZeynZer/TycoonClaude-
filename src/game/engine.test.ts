import { beforeEach, describe, expect, it } from 'vitest';
import { BUILDING_IDS, GOOD_IDS, UPGRADES, etherFor } from './data';
import { buildingCost, computeDerived, maxAffordable, saleValue, satFactor, steadyState } from './economy';
import * as E from './engine';
import { exportSave, hydrate, importSave, newState } from './state';

let seed = 1;
beforeEach(() => {
  seed = 1;
  E.setRng(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
});

describe('coûts', () => {
  it('le coût groupé égale la somme des coûts unitaires', () => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += buildingCost('evap', 5 + i, 1);
    expect(buildingCost('evap', 5, 10)).toBeCloseTo(sum, 6);
  });
  it('maxAffordable ne dépasse jamais le budget', () => {
    for (const money of [10, 1e3, 1e9, 1e30]) {
      const n = maxAffordable('cond', 17, money);
      expect(buildingCost('cond', 17, n)).toBeLessThanOrEqual(money * (1 + 1e-9));
      expect(buildingCost('cond', 17, n + 1)).toBeGreaterThan(money);
    }
  });
});

describe('marché', () => {
  it('vendre en un bloc = vendre en morceaux (intégrale exacte)', () => {
    const p0 = 10, D = 50;
    const whole = saleValue(p0, D, 0.3, 200);
    let S = 0.3, parts = 0;
    for (let i = 0; i < 200; i++) {
      parts += saleValue(p0, D, S, 1);
      S += 1 / D;
    }
    expect(parts).toBeCloseTo(whole, 6);
  });
  it('le prix ne descend jamais sous le plancher', () => {
    expect(satFactor(1e9)).toBeGreaterThanOrEqual(0.3);
    expect(satFactor(0)).toBe(1);
  });
});

describe('production', () => {
  it('un convertisseur sans intrants est à 0 % d’efficacité', () => {
    const s = newState();
    s.buildings.cond.n = 5;
    const st = steadyState(s, computeDerived(s));
    expect(st.flows.eff.cond).toBe(0);
    expect(st.flows.produced.nuage).toBe(0);
  });
  it('la chaîne vapeur → nuage conserve la matière', () => {
    const s = newState();
    s.buildings.evap.n = 100;
    s.buildings.cond.n = 5;
    const st = steadyState(s, computeDerived(s));
    expect(st.flows.consumed.vapeur).toBeCloseTo(st.flows.produced.nuage * 4, 6);
    expect(st.income).toBeGreaterThan(0);
  });
  it('le tick produit et vend', () => {
    const s = newState();
    s.buildings.evap.n = 10;
    for (let i = 0; i < 100; i++) E.tick(s, 0.1);
    expect(s.money).toBeGreaterThan(15);
    expect(s.runEarned).toBeGreaterThan(0);
  });
});

describe('progression', () => {
  it('acheter un bâtiment débite le bon montant', () => {
    const s = newState();
    s.money = 1000;
    const cost = buildingCost('evap', 0, 10);
    expect(E.buyBuilding(s, 'evap', 10)).toBe(true);
    expect(s.money).toBeCloseTo(1000 - cost, 6);
    expect(s.buildings.evap.n).toBe(10);
  });
  it('les améliorations ont des identifiants uniques', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });
  it('le prestige conserve l’éther, les succès et réinitialise les bâtiments', () => {
    const s = newState();
    s.totalEarned = 1e13;
    s.buildings.evap.n = 300;
    s.achievements.x = 1;
    const gain = E.prestigeGain(s);
    expect(gain).toBe(etherFor(1e13));
    const p = E.prestige(s);
    expect(p.ether).toBe(gain);
    expect(p.buildings.evap.n).toBe(0);
    expect(p.achievements.x).toBe(1);
    expect(E.prestigeGain(p)).toBe(0);
  });
  it('les gains hors-ligne sont plafonnés', () => {
    const s = newState();
    s.buildings.evap.n = 50;
    E.refresh(s);
    const r = E.applyOffline(s, 1e7)!;
    expect(r.seconds).toBe(E.offlineCapSeconds(s));
    expect(r.money).toBeGreaterThan(0);
  });
  it('la tempête se déclenche après assez de taps', () => {
    const s = newState();
    E.refresh(s);
    let storm = false;
    for (let i = 0; i < 80 && !storm; i++) storm = E.tap(s).storm;
    expect(storm).toBe(true);
    expect(s.stats.storms).toBe(1);
  });
});

describe('sauvegarde', () => {
  it('export → import est fidèle', () => {
    const s = newState();
    s.money = 123456;
    s.upgrades.evap_0 = true;
    s.settings.name = 'Zéphyr ☁️';
    const back = importSave(exportSave(s));
    expect(back.money).toBe(123456);
    expect(back.upgrades.evap_0).toBe(true);
    expect(back.settings.name).toBe('Zéphyr ☁️');
  });
  it('hydrate répare une sauvegarde partielle ou corrompue', () => {
    const s = hydrate({ money: 'abc', buildings: { evap: { n: 4 } }, stock: { pluie: NaN } });
    expect(s.money).toBe(15);
    expect(s.buildings.evap.n).toBe(4);
    expect(s.buildings.evap.on).toBe(true);
    for (const g of GOOD_IDS) expect(Number.isFinite(s.stock[g])).toBe(true);
    for (const b of BUILDING_IDS) expect(s.buildings[b]).toBeDefined();
  });
});
