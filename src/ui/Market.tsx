import { EVENTS, GOODS, GOOD_IDS, REACH_MULT, SEASONS, SEASON_LENGTH, reachCost, type GoodId } from '../game/data';
import { SAT_FLOOR, isGoodUnlocked, satFactor, seasonIndex, storageCap, unitPrice } from '../game/economy';
import * as E from '../game/engine';
import { duration, fmt, money, pct, qty } from '../game/format';
import { sfx } from '../audio';
import { act, useGame } from '../store';
import { spawnFloat } from './fx';

export function Market() {
  const s = useGame();
  const si = seasonIndex(s.time);
  const season = SEASONS[si];
  const next = SEASONS[(si + 1) % 4];
  const left = SEASON_LENGTH - (s.time % SEASON_LENGTH);
  const goods = GOOD_IDS.filter((g) => isGoodUnlocked(s, g));
  const oracle = (s.etherUpg.forecast || 0) > 0;
  const nextEv = EVENTS.find((e) => e.id === s.nextEventId);
  const highlights = (Object.entries(next.demand) as [GoodId, number][]).filter(([g]) => isGoodUnlocked(s, g)).sort((a, b) => b[1] - a[1]);
  return (
    <div className="tab">
      <h2>📈 Bourse météo</h2>
      <div className="card season">
        <div className="row-between">
          <div>
            <div className="big">{season.emoji} {season.name}</div>
            <div className="small muted">encore {duration(left)}</div>
          </div>
          <div className="right">
            <div className="small muted">Ensuite</div>
            <div><b>{next.emoji} {next.name}</b></div>
          </div>
        </div>
        {highlights.length > 0 && (
          <div className="chips">
            <span className="chip">Demande en {next.name.toLowerCase()} :</span>
            {highlights.slice(0, 4).map(([g, m]) => (
              <span key={g} className={`chip ${m >= 1 ? 'up' : 'down'}`}>{GOODS[g].emoji} ×{m.toFixed(2).replace('.', ',')}</span>
            ))}
          </div>
        )}
        <div className="tip small">💡 Coupez la vente auto d'un bien avant sa saison faste, puis vendez votre stock au sommet.</div>
      </div>
      {s.events.length > 0 && (
        <div className="events">
          {s.events.map((ev) => {
            const def = EVENTS.find((e) => e.id === ev.id)!;
            return (
              <div key={ev.id + ev.until} className="card event">
                <span className="ev-emoji">{def.emoji}</span>
                <div>
                  <b>{def.title}</b>
                  <div className="small">{def.text}</div>
                  <div className="chips">
                    {Object.entries(def.demand).map(([g, m]) => (
                      <span key={g} className={`chip ${(m as number) >= 1 ? 'up' : 'down'}`}>{g === 'all' ? 'Tout' : GOODS[g as GoodId].emoji} ×{String(m).replace('.', ',')}</span>
                    ))}
                    <span className="chip">⏱ {duration(ev.until - s.time)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {oracle && nextEv && (
        <div className="card oracle small">🔭 Oracle : <b>{nextEv.emoji} {nextEv.title}</b> dans {duration(s.nextEventAt - s.time)}</div>
      )}
      {s.buffs.marketUntil > s.time && <div className="card buff">🐦 Marché fou ! Prix ×3 pendant {duration(s.buffs.marketUntil - s.time)}</div>}
      {goods.length === 0 && <div className="card muted">Achetez un Évaporateur pour commencer à vendre de la vapeur.</div>}
      {goods.map((g) => (
        <GoodRow key={g} g={g} />
      ))}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <svg className="spark" viewBox="0 0 100 30" />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline points={`0,30 ${pts} 100,30`} fill={color} opacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function GoodRow({ g }: { g: GoodId }) {
  const s = useGame();
  const { d, steady } = E.snapshot(s);
  const def = GOODS[g];
  const price = unitPrice(s, d, g);
  const index = d.demand[g] * satFactor(s.sat[g]);
  const sat = 1 - (satFactor(s.sat[g]) - SAT_FLOOR) / (1 - SAT_FLOOR);
  const h = s.hist[g];
  const trend = h.length > 3 ? h[h.length - 1] / h[h.length - 4] - 1 : 0;
  const cap = storageCap(s, d, g, steady.flows);
  const stock = s.stock[g];
  const preview = stock > 0 ? E.previewSale(s, g, stock) : 0;
  const rc = reachCost(g, s.reach[g]);
  const net = steady.flows.produced[g] - steady.flows.consumed[g];

  const sell = (e: React.MouseEvent) => {
    const v = act((x) => E.sellStock(x, g));
    if (v > 0) {
      sfx.sell();
      spawnFloat(e.clientX, e.clientY - 20, `+${money(v)}`, 'gold');
    }
  };
  return (
    <div className="card good" style={{ ['--accent' as any]: def.color }}>
      <div className="row-between">
        <div className="g-title">
          <span className="g-emoji">{def.emoji}</span>
          <div>
            <b>{def.name}</b>
            <div className="small muted">{def.client}</div>
          </div>
        </div>
        <div className="right">
          <div className="price">{money(price)}</div>
          <div className={`small ${index >= 1 ? 'pos' : 'neg'}`}>
            {trend > 0.01 ? '▲' : trend < -0.01 ? '▼' : '■'} indice {pct(index)}
          </div>
        </div>
      </div>
      <Sparkline data={h} color={def.color} />
      <div className="g-stats small">
        <div>
          <span className="muted">Saturation</span>
          <div className="bar"><div className={`fill ${sat > 0.6 ? 'hot' : ''}`} style={{ width: `${sat * 100}%` }} /></div>
        </div>
        <div>
          <span className="muted">Stock {qty(stock)} / {qty(cap)}</span>
          <div className="bar"><div className="fill stock" style={{ width: `${Math.min(100, (stock / cap) * 100)}%` }} /></div>
        </div>
      </div>
      <div className="small muted">
        Flux net {net >= 0 ? '+' : ''}{qty(net)}/s{s.autoSell[g] && steady.revenue[g] > 0 ? ` · ${money(steady.revenue[g])}/s` : ''}
      </div>
      <div className="g-actions">
        <button className={`toggle ${s.autoSell[g] ? 'on' : ''}`} onClick={() => act((x) => E.toggleAutoSell(x, g))}>
          {s.autoSell[g] ? '🔁 Vente auto' : '📦 Stockage'}
        </button>
        <button className="sell" disabled={stock <= 0} onClick={sell}>
          Vendre {stock > 0 ? `· ${money(preview)}` : ''}
        </button>
        <button
          className={`reach ${s.money >= rc ? 'can' : ''}`}
          onClick={() => {
            if (act((x) => E.buyReach(x, g))) sfx.upgrade();
            else sfx.cantBuy();
          }}
          title={`Profondeur du marché ×${REACH_MULT}`}
        >
          🌍 Portée {s.reach[g]} → {fmt(rc)} $
        </button>
      </div>
    </div>
  );
}
