import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, BUILDINGS, EVENTS, GOODS, SEASONS, SEASON_LENGTH, UPGRADES } from '../game/data';
import { seasonIndex } from '../game/economy';
import * as E from '../game/engine';
import { duration, fmt, money } from '../game/format';
import { sfx } from '../audio';
import * as Cloud from '../cloud/cloud';
import { act, game, useGame } from '../store';
import { Contracts } from './Contracts';
import { Factory } from './Factory';
import { confetti } from './fx';
import { Market } from './Market';
import { More } from './More';
import { Prestige } from './Prestige';
import { Sky } from './Sky';
import { Upgrades } from './Upgrades';
import { Tutorial } from './Tutorial';

type Tab = 'factory' | 'market' | 'upgrades' | 'contracts' | 'prestige' | 'more';

interface Toast {
  id: number;
  emoji: string;
  title: string;
  text?: string;
  kind?: string;
}
let toastId = 0;

export function App({ updateReady, applyUpdate }: { updateReady: boolean; applyUpdate: () => void }) {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('factory');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [offline, setOffline] = useState(game.offline);

  const push = (t: Omit<Toast, 'id'>) => {
    const id = ++toastId;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200);
  };

  useEffect(() => {
    return E.onGameEvent((e) => {
      switch (e.type) {
        case 'achievement': {
          const a = ACHIEVEMENTS.find((x) => x.id === e.id)!;
          sfx.achievement();
          push({ emoji: '🏆', title: a.name, text: `${a.desc} · +${a.reward} 🧊`, kind: 'gold' });
          break;
        }
        case 'milestone':
          push({ emoji: BUILDINGS[e.building].emoji, title: `Palier ${e.n} !`, text: `${BUILDINGS[e.building].name} : vitesse ×2` });
          if (e.n >= 100) confetti(50);
          break;
        case 'contractDone':
          sfx.contract();
          push({ emoji: '✅', title: `Contrat honoré : ${e.contract.client}`, text: `+${money(e.contract.reward)}${e.contract.grelons ? ` +${e.contract.grelons} 🧊` : ''}`, kind: 'gold' });
          break;
        case 'contractFail':
          push({ emoji: '❌', title: 'Contrat expiré', text: e.contract.client, kind: 'bad' });
          break;
        case 'contractNew':
          break;
        case 'event': {
          const ev = EVENTS.find((x) => x.id === e.id)!;
          sfx.event();
          push({ emoji: ev.emoji, title: ev.title, text: ev.text });
          break;
        }
        case 'bird':
          sfx.bird();
          break;
        case 'birdReward': {
          const txt = e.kind === 'frenzy' ? 'Frénésie : revenus ×7 !' : e.kind === 'cash' ? `Pluie d'or : +${money(e.amount)}` : e.kind === 'market' ? 'Marché fou : saturation effacée, prix ×3 !' : `+${e.amount} 🧊 grêlons`;
          push({ emoji: '🐦', title: 'Oiseau-tonnerre attrapé !', text: txt, kind: 'gold' });
          break;
        }
        case 'storm':
          push({ emoji: '🌪️', title: 'TEMPÊTE !', text: 'Revenus et taps ×3', kind: 'storm' });
          break;
        case 'toast':
          push({ emoji: e.emoji ?? 'ℹ️', title: e.text });
          break;
      }
    });
  }, []);

  // synchro cloud périodique
  useEffect(() => {
    if (!Cloud.cloudEnabled) return;
    const t = setInterval(() => {
      if (game.s.cloud) Cloud.push(game.s).catch(() => {});
    }, 120000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (game.offline && !offline) setOffline(game.offline);
    }, 1000);
    return () => clearInterval(t);
  }, [offline]);

  const { steady, d } = E.snapshot(s);
  const si = seasonIndex(s.time);
  const season = SEASONS[si];
  const seasonLeft = SEASON_LENGTH - (s.time % SEASON_LENGTH);
  const buffs: { k: string; label: string }[] = [];
  if (s.buffs.frenzyUntil > s.time) buffs.push({ k: 'f', label: `🐦 ×${s.buffs.frenzyMult} ${Math.ceil(s.buffs.frenzyUntil - s.time)}s` });
  if (s.buffs.stormUntil > s.time) buffs.push({ k: 's', label: `🌪️ ×3 ${Math.ceil(s.buffs.stormUntil - s.time)}s` });
  if (s.buffs.boostUntil > s.time) buffs.push({ k: 'b', label: `🚀 ×2 ${duration(s.buffs.boostUntil - s.time)}` });
  if (s.buffs.marketUntil > s.time) buffs.push({ k: 'm', label: `📈 prix ×3 ${Math.ceil(s.buffs.marketUntil - s.time)}s` });

  const affordableUps = countAffordableUpgrades(s);
  const offers = s.contracts.filter((c) => !c.accepted).length;
  const gain = E.prestigeGain(s);
  const moreDot = E.canClaimDaily(s) || s.daily.quests.some((q) => !q.claimed && q.progress >= q.target);

  const tabs: [Tab, string, string, number | boolean][] = [
    ['factory', '🏭', 'Usine', false],
    ['market', '📈', 'Marché', s.events.length > 0],
    ['upgrades', '🔧', 'Amélio.', affordableUps],
    ['contracts', '📜', 'Contrats', offers],
    ['prestige', '✨', 'Éther', gain >= Math.max(25, s.ether * 0.5)],
    ['more', '☰', 'Plus', moreDot],
  ];

  const ticker = s.events.length
    ? s.events.map((ev) => { const def = EVENTS.find((x) => x.id === ev.id)!; return `${def.emoji} ${def.title} — ${def.text}`; }).join('   •   ')
    : `${season.emoji} ${season.name} · demande forte : ${Object.entries(season.demand).filter(([, m]) => (m as number) > 1).map(([g]) => GOODS[g as keyof typeof GOODS].emoji).join(' ')}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="money-block">
          <div className="money" id="money">{money(s.money)}</div>
          <div className="income">+{money(steady.income)}/s</div>
        </div>
        <div className="currencies">
          <span className="pill" title="Éther">💠 {fmt(s.ether)}</span>
          <span className="pill" id="grelons" title="Grêlons">🧊 {s.grelons}</span>
          <span className="pill season-pill" title="Saison">{season.emoji} {duration(seasonLeft)}</span>
        </div>
      </header>
      {buffs.length > 0 && (
        <div className="buffs">
          {buffs.map((b) => <span key={b.k} className="buff-pill">{b.label}</span>)}
          <span className="buff-pill mult">×{fmt(d.moneyMult)}</span>
        </div>
      )}
      <Sky />
      <div className="ticker"><div className="ticker-inner" key={ticker}>{ticker}</div></div>
      {updateReady && (
        <button className="update-bar" onClick={applyUpdate}>✨ Nouvelle version disponible — toucher pour mettre à jour</button>
      )}
      <main className="content">
        {tab === 'factory' && <Factory />}
        {tab === 'market' && <Market />}
        {tab === 'upgrades' && <Upgrades />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'prestige' && <Prestige />}
        {tab === 'more' && <More />}
      </main>
      <nav className="tabbar">
        {tabs.map(([id, icon, label, badge]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span className="t-icon">{icon}</span>
            <span className="t-label">{label}</span>
            {badge ? <i className="badge-dot">{typeof badge === 'number' ? badge : ''}</i> : null}
          </button>
        ))}
      </nav>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            <span className="t-emoji">{t.emoji}</span>
            <div>
              <b>{t.title}</b>
              {t.text && <div className="small">{t.text}</div>}
            </div>
          </div>
        ))}
      </div>
      {offline && (
        <div className="modal-back" onClick={() => { setOffline(null); game.offline = null; }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-emoji">🌙</div>
            <h2>Bon retour !</h2>
            <p>Pendant vos {duration(offline.seconds)} d'absence, l'usine a tourné à {Math.round(offline.efficiency * 100)} % :</p>
            <div className="big gold">+{money(offline.money)}</div>
            <div className="btns">
              <button className="ghost" onClick={() => { setOffline(null); game.offline = null; sfx.buy(); }}>Encaisser</button>
              <button
                className="primary"
                disabled={s.grelons < 3}
                onClick={() => {
                  act((x) => {
                    if (x.grelons < 3) return;
                    x.grelons -= 3;
                    x.money += offline.money;
                    x.runEarned += offline.money;
                    x.totalEarned += offline.money;
                  });
                  sfx.reward();
                  confetti(60);
                  setOffline(null);
                  game.offline = null;
                }}
              >
                Doubler (3 🧊)
              </button>
            </div>
          </div>
        </div>
      )}
      <Tutorial onGo={(t) => setTab(t as Tab)} />
    </div>
  );
}

function countAffordableUpgrades(s: ReturnType<typeof useGame>): number {
  let n = 0;
  for (const u of UPGRADES) {
    if (u.cost > s.money) break;
    if (E.upgradeAvailable(s, u.id)) n++;
  }
  return n;
}
