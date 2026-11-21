import { useState } from 'react';
import { BUILDINGS, BUILDING_IDS, GOODS, MILESTONES, nextMilestone, type BuildingId, type GoodId } from '../game/data';
import { isBuildingVisible } from '../game/economy';
import * as E from '../game/engine';
import { fmt, money, pct, qty } from '../game/format';
import { sfx } from '../audio';
import { act, useGame } from '../store';
import { burst } from './fx';

const QTYS: E.BuyQty[] = [1, 10, 100, 'max'];

export function Factory() {
  const s = useGame();
  const [q, setQ] = useState<E.BuyQty>(1);
  const visible = BUILDING_IDS.filter((id) => isBuildingVisible(s, id));
  const nextLocked = BUILDING_IDS.find((id) => !isBuildingVisible(s, id));
  return (
    <div className="tab">
      <div className="row-between sticky-sub">
        <h2>🏭 Usine</h2>
        <div className="seg">
          {QTYS.map((x) => (
            <button key={String(x)} className={q === x ? 'on' : ''} onClick={() => setQ(x)}>
              {x === 'max' ? 'MAX' : `×${x}`}
            </button>
          ))}
        </div>
      </div>
      {visible.map((id) => (
        <BuildingCard key={id} id={id} q={q} />
      ))}
      {nextLocked && (
        <div className="card locked">
          <div className="b-icon">❓</div>
          <div>
            <b>Bâtiment mystère</b>
            <div className="muted small">Achetez un {BUILDINGS[BUILDING_IDS[BUILDING_IDS.indexOf(nextLocked) - 1]].name} pour le révéler.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function BuildingCard({ id, q }: { id: BuildingId; q: E.BuyQty }) {
  const s = useGame();
  const b = BUILDINGS[id];
  const st = s.buildings[id];
  const quote = E.quoteBuilding(s, id, q);
  const can = s.money >= quote.cost;
  const info = E.buildingRateInfo(s, id);
  const nm = nextMilestone(st.n);
  const prevM = [...MILESTONES].reverse().find((m) => m <= st.n) ?? 0;
  const prog = nm ? (st.n - prevM) / (nm - prevM) : 1;
  const good = GOODS[b.good];
  const starving = st.n > 0 && st.on && info.eff < 0.98;
  const inputs = Object.entries(b.inputs) as [GoodId, number][];

  const buy = (e: React.MouseEvent) => {
    const before = st.n;
    const ok = act((x) => E.buyBuilding(x, id, q));
    if (ok) {
      const crossed = MILESTONES.some((m) => before < m && before + quote.qty >= m);
      if (crossed) {
        sfx.milestone();
        burst(e.clientX, e.clientY, 18, '⭐');
      } else sfx.buy();
    } else sfx.cantBuy();
  };

  return (
    <div className={`card building ${st.on ? '' : 'off'}`} style={{ ['--accent' as any]: good.color }}>
      <div className="b-head">
        <div className="b-icon">{b.emoji}</div>
        <div className="b-main">
          <div className="row-between">
            <b>{b.name}</b>
            <span className="badge">{st.n}</span>
          </div>
          <div className="small muted">
            {st.n > 0 ? (
              <>
                {good.emoji} {qty(info.total)}/s
                {inputs.length > 0 && (
                  <> · consomme {inputs.map(([g, n]) => `${qty(info.cycles * n)} ${GOODS[g].emoji}`).join(' ')}</>
                )}
              </>
            ) : (
              b.desc
            )}
          </div>
          {starving && (
            <div className="warn small">
              ⚠️ Efficacité {pct(info.eff)} — manque de {inputs.map(([g]) => GOODS[g].emoji).join(' ')} : développez l'étage inférieur
            </div>
          )}
          <div className="ms">
            <div className="ms-bar" style={{ width: `${prog * 100}%` }} />
            <span>{nm ? `Palier ${nm} → vitesse ×2` : 'Tous les paliers atteints !'}</span>
          </div>
        </div>
      </div>
      <div className="b-actions">
        {st.n > 0 && (
          <button className="ghost small" onClick={() => act((x) => E.toggleBuilding(x, id))} title="Mettre en pause">
            {st.on ? <span className="pause-ico" /> : '▶'}
          </button>
        )}
        <button className={`buy ${can ? 'can' : ''}`} onClick={buy}>
          <span>Acheter ×{fmt(quote.qty, 0)}</span>
          <b>{money(quote.cost)}</b>
        </button>
      </div>
    </div>
  );
}

