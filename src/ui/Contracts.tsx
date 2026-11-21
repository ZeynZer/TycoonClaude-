import { GOODS } from '../game/data';
import * as E from '../game/engine';
import { duration, money, qty } from '../game/format';
import { sfx } from '../audio';
import { act, useGame } from '../store';

export function Contracts() {
  const s = useGame();
  const active = s.contracts.filter((c) => c.accepted);
  const offers = s.contracts.filter((c) => !c.accepted);
  const { steady } = E.snapshot(s);
  return (
    <div className="tab">
      <div className="row-between">
        <h2>📜 Contrats</h2>
        <span className="muted small">{s.stats.contracts} honorés</span>
      </div>
      <div className="tip small card">
        Un contrat accepté capte en priorité la production du bien demandé (avant la vente). Les récompenses valent 3 à 4× le prix du marché, et parfois des grêlons 🧊.
      </div>
      {active.length > 0 && <h3>En cours</h3>}
      {active.map((c) => {
        const p = c.filled / c.qty;
        const left = c.deadline - s.time;
        const rate = steady.flows.produced[c.good];
        const eta = rate > 0 ? (c.qty - c.filled) / rate : Infinity;
        const late = eta > left;
        return (
          <div key={c.id} className="card contract active">
            <div className="row-between">
              <b>{GOODS[c.good].emoji} {c.client}</b>
              <span className={`small ${left < 30 ? 'neg' : 'muted'}`}>⏱ {duration(left)}</span>
            </div>
            <div className="bar big"><div className="fill" style={{ width: `${p * 100}%` }} /></div>
            <div className="row-between small">
              <span>{qty(c.filled)} / {qty(c.qty)} {GOODS[c.good].name}</span>
              <span className={late ? 'neg' : 'pos'}>{Number.isFinite(eta) ? `fin estimée ${duration(eta)}` : 'aucune production !'}</span>
            </div>
            <div className="row-between">
              <span className="reward">🎁 {money(c.reward)}{c.grelons ? ` + ${c.grelons} 🧊` : ''}</span>
              <button className="ghost small" onClick={() => act((x) => E.declineContract(x, c.id))}>Abandonner</button>
            </div>
          </div>
        );
      })}
      <h3>Offres</h3>
      {offers.length === 0 && <div className="card muted">De nouveaux clients vont bientôt vous contacter…</div>}
      {offers.map((c) => (
        <div key={c.id} className="card contract">
          <div className="row-between">
            <b>{GOODS[c.good].emoji} {c.client}</b>
            <span className="small muted">offre valable {duration(c.offerUntil - s.time)}</span>
          </div>
          <div className="small">
            Livrer <b>{qty(c.qty)} {GOODS[c.good].name}</b> en {duration(c.duration)}
          </div>
          <div className="row-between">
            <span className="reward">🎁 {money(c.reward)}{c.grelons ? ` + ${c.grelons} 🧊` : ''}</span>
            <div className="btns">
              <button className="ghost small" onClick={() => act((x) => E.declineContract(x, c.id))}>Refuser</button>
              <button
                className="primary small"
                onClick={() => {
                  act((x) => E.acceptContract(x, c.id));
                  sfx.contract();
                }}
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        className="ghost wide"
        disabled={s.grelons < 2}
        onClick={() => {
          if (act((x) => E.buyShop(x, 'reroll'))) sfx.buy();
        }}
      >
        🔄 Nouvelles offres (2 🧊)
      </button>
    </div>
  );
}
