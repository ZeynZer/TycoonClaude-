import { useState } from 'react';
import { ETHER_UPGRADES, etherFor } from '../game/data';
import { etherPct } from '../game/economy';
import * as E from '../game/engine';
import { duration, fmt, money } from '../game/format';
import { sfx } from '../audio';
import { act, game, replaceState, useGame } from '../store';
import { confetti } from './fx';

export function Prestige() {
  const s = useGame();
  const [confirm, setConfirm] = useState(false);
  const gain = E.prestigeGain(s);
  const p = etherPct(s);
  const nowBonus = s.ether * p;
  const afterBonus = (s.ether + gain) * p;
  const mult = (1 + afterBonus) / (1 + nowBonus);
  // gains nécessaires pour le prochain éther
  const nextTarget = (() => {
    const want = s.etherClaimed + gain + 1;
    let lo = s.totalEarned, hi = Math.max(1e3, s.totalEarned * 2);
    while (etherFor(hi) < want) hi *= 2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (etherFor(mid) >= want) hi = mid; else lo = mid;
    }
    return hi - s.totalEarned;
  })();
  const recommended = gain >= Math.max(25, s.ether * 0.5);

  const doPrestige = () => {
    sfx.prestige();
    confetti(140);
    document.body.classList.add('flash-white');
    setTimeout(() => document.body.classList.remove('flash-white'), 900);
    replaceState(E.prestige(game.s));
    setConfirm(false);
  };

  return (
    <div className="tab">
      <h2>✨ Éther</h2>
      <div className="card ether-hero">
        <div className="ether-count">💠 {fmt(s.ether)}</div>
        <div className="small">Éther non dépensé : <b>+{fmt(nowBonus * 100)} %</b> de revenus ({Math.round(p * 100)} % chacun)</div>
        <div className="small muted">Partie en cours : {duration(s.runTime)} · gagné {money(s.runEarned)}</div>
      </div>
      <div className={`card prestige-box ${recommended ? 'glow' : ''}`}>
        <h3>🌅 Nouvelle ère climatique</h3>
        <p className="small">
          Réinitialise vos bâtiments, argent, améliorations et portées. Vous gardez l'Éther, ses améliorations, les succès, les grêlons et les statistiques.
        </p>
        <div className="big">+{fmt(gain)} 💠</div>
        <div className="small">
          Revenus ×{mult.toFixed(2).replace('.', ',')} après le prestige
        </div>
        <div className="small muted">Prochain Éther dans {money(nextTarget)} gagnés</div>
        {recommended && <div className="pos small">✅ Moment idéal pour renaître !</div>}
        {!confirm ? (
          <button className="primary wide" disabled={gain < 1} onClick={() => setConfirm(true)}>
            {gain < 1 ? 'Pas encore assez de gains' : `Renaître (+${fmt(gain)} 💠)`}
          </button>
        ) : (
          <div className="btns">
            <button className="ghost" onClick={() => setConfirm(false)}>Annuler</button>
            <button className="danger" onClick={doPrestige}>Confirmer la renaissance</button>
          </div>
        )}
      </div>
      <h3>Arbre de l'Éther</h3>
      <div className="small muted">Dépenser de l'Éther réduit son bonus passif : choisissez bien !</div>
      <div className="grid-up">
        {ETHER_UPGRADES.map((u) => {
          const lvl = s.etherUpg[u.id] || 0;
          const max = lvl >= u.max;
          const cost = Math.ceil(u.cost(lvl));
          const can = !max && s.ether >= cost;
          return (
            <button
              key={u.id}
              className={`card up ether ${can ? 'can' : ''} ${max ? 'maxed' : ''}`}
              disabled={max}
              onClick={() => {
                if (act((x) => E.buyEtherUpgrade(x, u.id))) sfx.upgrade();
                else sfx.cantBuy();
              }}
            >
              <span className="up-emoji">{u.emoji}</span>
              <b>{u.name}</b>
              <span className="small">{u.desc}</span>
              <span className="lvl">niv. {lvl}/{u.max}</span>
              <span className="cost">{max ? 'MAX' : `${fmt(cost)} 💠`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
