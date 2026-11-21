import { BUILDINGS, UPGRADES } from '../game/data';
import * as E from '../game/engine';
import { money } from '../game/format';
import { sfx } from '../audio';
import { act, useGame } from '../store';
import { burst } from './fx';

export function Upgrades() {
  const s = useGame();
  const avail = UPGRADES.filter((u) => E.upgradeAvailable(s, u.id));
  const owned = UPGRADES.filter((u) => s.upgrades[u.id]).length;
  const upcoming = UPGRADES.filter((u) => !s.upgrades[u.id] && !E.upgradeAvailable(s, u.id) && u.req.building && s.buildings[u.req.building].n > 0)
    .sort((a, b) => (a.req.count ?? 0) - (s.buildings[a.req.building!].n) - ((b.req.count ?? 0) - s.buildings[b.req.building!].n))
    .slice(0, 4);
  const affordable = avail.filter((u) => u.cost <= s.money);
  const buyAll = () => {
    let n = 0;
    act((x) => {
      for (const u of UPGRADES) if (E.upgradeAvailable(x, u.id) && u.cost <= x.money && E.buyUpgrade(x, u.id)) n++;
    });
    if (n) sfx.upgrade();
  };
  return (
    <div className="tab">
      <div className="row-between">
        <h2>🔧 Améliorations</h2>
        <span className="muted small">{owned}/{UPGRADES.length}</span>
      </div>
      {affordable.length > 1 && (
        <button className="primary wide" onClick={buyAll}>
          Tout acheter ({affordable.length})
        </button>
      )}
      {avail.length === 0 && <div className="card muted">Aucune amélioration disponible. Augmentez vos bâtiments pour en débloquer !</div>}
      <div className="grid-up">
        {avail.slice(0, 30).map((u) => {
          const can = s.money >= u.cost;
          return (
            <button
              key={u.id}
              className={`card up ${can ? 'can' : ''}`}
              onClick={(e) => {
                if (act((x) => E.buyUpgrade(x, u.id))) {
                  sfx.upgrade();
                  burst(e.clientX, e.clientY, 10, '✨');
                } else sfx.cantBuy();
              }}
            >
              <span className="up-emoji">{u.emoji}</span>
              <b>{u.name}</b>
              <span className="small">{u.desc}</span>
              <span className="cost">{money(u.cost)}</span>
            </button>
          );
        })}
      </div>
      {upcoming.length > 0 && (
        <>
          <h3 className="muted">Prochainement</h3>
          {upcoming.map((u) => (
            <div key={u.id} className="card locked small">
              🔒 <b>{u.name}</b> — {u.desc} <span className="muted">(à {u.req.count} {BUILDINGS[u.req.building!].name}s)</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
