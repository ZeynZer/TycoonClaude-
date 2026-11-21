import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, ACH_BONUS, DAILY_REWARDS, QUEST_TEMPLATES, SHOP } from '../game/data';
import * as E from '../game/engine';
import { duration, fmt, money, setNotation } from '../game/format';
import { clearLocal, exportSave, importSave, newState } from '../game/state';
import * as Cloud from '../cloud/cloud';
import { sfx } from '../audio';
import { act, game, replaceState, saveNow, useGame } from '../store';
import { confetti } from './fx';
import { installApp, canInstall } from '../pwa';

type Sub = 'daily' | 'shop' | 'ach' | 'rank' | 'stats' | 'settings';
const SUBS: [Sub, string][] = [
  ['daily', '🎁 Quotidien'],
  ['shop', '🧊 Boutique'],
  ['ach', '🏆 Succès'],
  ['rank', '🥇 Classement'],
  ['stats', '📊 Stats'],
  ['settings', '⚙️ Réglages'],
];

export function More({ initial }: { initial?: Sub }) {
  const [sub, setSub] = useState<Sub>(initial ?? 'daily');
  const s = useGame();
  const dailyReady = E.canClaimDaily(s) || s.daily.quests.some((q) => !q.claimed && q.progress >= q.target);
  return (
    <div className="tab">
      <div className="subnav">
        {SUBS.map(([id, label]) => (
          <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>
            {label}
            {id === 'daily' && dailyReady && <i className="dot" />}
          </button>
        ))}
      </div>
      {sub === 'daily' && <Daily />}
      {sub === 'shop' && <Shop />}
      {sub === 'ach' && <Achievements />}
      {sub === 'rank' && <Ranking />}
      {sub === 'stats' && <Stats />}
      {sub === 'settings' && <Settings />}
    </div>
  );
}

function Daily() {
  const s = useGame();
  const can = E.canClaimDaily(s);
  const idx = E.nextDailyIndex(s);
  return (
    <>
      <div className="card">
        <h3>Bonus de connexion</h3>
        <div className="small muted">Série actuelle : {s.daily.streak} jour{s.daily.streak > 1 ? 's' : ''} 🔥</div>
        <div className="daily-grid">
          {DAILY_REWARDS.map((r, i) => {
            const done = can ? i < idx : i <= (s.daily.streak - 1) % 7;
            const today = can && i === idx;
            return (
              <div key={i} className={`day ${done ? 'done' : ''} ${today ? 'today' : ''}`}>
                <span className="small">J{i + 1}</span>
                <b>{r.label}</b>
              </div>
            );
          })}
        </div>
        <button
          className="primary wide"
          disabled={!can}
          onClick={() => {
            if (act((x) => E.claimDaily(x))) {
              sfx.reward();
              confetti(60);
            }
          }}
        >
          {can ? 'Récupérer' : 'Revenez demain !'}
        </button>
      </div>
      <div className="card">
        <h3>Missions du jour</h3>
        {s.daily.quests.map((q, i) => {
          const t = QUEST_TEMPLATES.find((x) => x.kind === q.kind);
          const done = q.progress >= q.target;
          return (
            <div key={i} className="quest">
              <div className="row-between">
                <span className="small">{t?.label(q.target)}</span>
                <span className="small">{fmt(q.progress)}/{q.target}</span>
              </div>
              <div className="bar"><div className="fill" style={{ width: `${(q.progress / q.target) * 100}%` }} /></div>
              <button
                className={`small ${done && !q.claimed ? 'primary' : 'ghost'}`}
                disabled={!done || q.claimed}
                onClick={() => {
                  if (act((x) => E.claimQuest(x, i))) sfx.reward();
                }}
              >
                {q.claimed ? '✅ Réclamé' : `+${q.reward} 🧊`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Shop() {
  const s = useGame();
  const inc = E.baseIncome(s);
  const boostLeft = s.buffs.boostUntil - s.time;
  return (
    <>
      <div className="card small">
        Vous avez <b>{s.grelons} 🧊 grêlons</b>. Gagnez-en avec les succès, les missions, le bonus quotidien, certains contrats et les Oiseaux-tonnerre.
      </div>
      {boostLeft > 0 && <div className="card buff">🚀 Turbo ×2 actif : {duration(boostLeft)}</div>}
      <div className="grid-up">
        {SHOP.filter((i) => i.id !== 'reroll').map((item) => {
          const can = s.grelons >= item.cost;
          const extra = item.id === 'warp1' ? money(inc * 3600) : item.id === 'warp8' ? money(inc * 3600 * 8) : '';
          return (
            <button
              key={item.id}
              className={`card up ${can ? 'can' : ''}`}
              onClick={() => {
                if (act((x) => E.buyShop(x, item.id))) {
                  sfx.reward();
                  if (item.id.startsWith('warp')) confetti(50);
                } else sfx.cantBuy();
              }}
            >
              <span className="up-emoji">{item.emoji}</span>
              <b>{item.name}</b>
              <span className="small">{item.desc}</span>
              {extra && <span className="small pos">≈ {extra}</span>}
              <span className="cost">{item.cost} 🧊</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Achievements() {
  const s = useGame();
  const got = Object.keys(s.achievements).length;
  return (
    <>
      <div className="card small">
        {got}/{ACHIEVEMENTS.length} succès · chaque succès donne <b>+{ACH_BONUS * 100} %</b> de revenus (actuellement +{Math.round(got * ACH_BONUS * 100)} %)
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const has = !!s.achievements[a.id];
          const p = E.achProgress(s, a.cond);
          return (
            <div key={a.id} className={`ach ${has ? 'got' : ''}`} title={a.desc}>
              <span className="ach-emoji">{has ? a.emoji : '🔒'}</span>
              <b className="small">{a.name}</b>
              <span className="tiny muted">{a.desc}</span>
              {!has && <div className="bar thin"><div className="fill" style={{ width: `${p * 100}%` }} /></div>}
              <span className="tiny">+{a.reward} 🧊</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Ranking() {
  const s = useGame();
  const [rows, setRows] = useState<Cloud.LeaderRow[] | null>(null);
  const [err, setErr] = useState('');
  const [name, setName] = useState(s.settings.name);
  const [busy, setBusy] = useState(false);
  const load = () => {
    Cloud.leaderboard().then(setRows).catch((e) => setErr(String(e.message || e)));
  };
  useEffect(() => {
    if (Cloud.cloudEnabled) load();
  }, []);
  if (!Cloud.cloudEnabled) return <div className="card muted">Le classement en ligne n'est pas configuré sur cette version.</div>;
  const join = async () => {
    const n = name.trim().slice(0, 20);
    if (n.length < 3) return setErr('Pseudo : 3 caractères minimum');
    setBusy(true);
    setErr('');
    try {
      const c = await Cloud.register(n);
      act((x) => {
        x.settings.name = n;
        x.cloud = c;
      });
      await Cloud.push(game.s);
      saveNow();
      load();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
    setBusy(false);
  };
  return (
    <>
      {!s.cloud ? (
        <div className="card">
          <h3>Rejoindre le classement</h3>
          <div className="small muted">Choisissez un pseudo. Votre partie sera aussi sauvegardée en ligne.</div>
          <div className="row">
            <input value={name} maxLength={20} placeholder="Pseudo" onChange={(e) => setName(e.target.value)} />
            <button className="primary" disabled={busy} onClick={join}>Rejoindre</button>
          </div>
        </div>
      ) : (
        <div className="card small row-between">
          <span>Connecté en tant que <b>{s.settings.name}</b></span>
          <button className="ghost small" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await Cloud.push(game.s); load(); } catch (e: any) { setErr(e.message); }
            setBusy(false);
          }}>☁️ Synchroniser</button>
        </div>
      )}
      {err && <div className="card neg small">{err}</div>}
      <div className="card">
        <div className="row-between"><h3>Top magnats</h3><button className="ghost small" onClick={load}>↻</button></div>
        {!rows && <div className="muted small">Chargement…</div>}
        {rows?.map((r) => (
          <div key={r.rank} className={`rank-row ${r.name === s.settings.name && s.cloud ? 'me' : ''}`}>
            <span className="rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</span>
            <span className="rname">{r.name}</span>
            <span className="small">{money(r.total_earned)}</span>
            <span className="small muted">💠{fmt(r.ether)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Stats() {
  const s = useGame();
  const { steady } = E.snapshot(s);
  const rows: [string, string][] = [
    ['Revenu actuel', `${money(steady.income)}/s`],
    ['Record de revenu', `${money(s.stats.maxIncome)}/s`],
    ['Gains de la partie', money(s.runEarned)],
    ['Gains depuis toujours', money(s.totalEarned)],
    ['Meilleure partie', money(Math.max(s.stats.bestRun, s.runEarned))],
    ['Temps de jeu', duration(s.stats.played)],
    ['Durée de la partie', duration(s.runTime)],
    ['Bâtiments achetés', fmt(s.stats.bought)],
    ['Taps', fmt(s.stats.taps)],
    ['Tempêtes', fmt(s.stats.storms)],
    ['Oiseaux attrapés', fmt(s.stats.birds)],
    ['Contrats honorés', fmt(s.stats.contracts)],
    ['Prestiges', fmt(s.stats.prestiges)],
    ['Éther obtenu', fmt(s.etherClaimed)],
  ];
  return (
    <div className="card">
      {rows.map(([k, v]) => (
        <div key={k} className="stat-row"><span className="muted">{k}</span><b>{v}</b></div>
      ))}
    </div>
  );
}

function Settings() {
  const s = useGame();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [resetAsk, setResetAsk] = useState(false);
  return (
    <>
      <div className="card">
        <label className="setting"><span>🔊 Sons</span><input type="checkbox" checked={s.settings.sound} onChange={() => act((x) => { x.settings.sound = !x.settings.sound; })} /></label>
        <label className="setting"><span>📳 Vibrations</span><input type="checkbox" checked={s.settings.haptics} onChange={() => act((x) => { x.settings.haptics = !x.settings.haptics; })} /></label>
        <label className="setting">
          <span>🔢 Notation scientifique</span>
          <input type="checkbox" checked={s.settings.notation === 'sci'} onChange={() => act((x) => { x.settings.notation = x.settings.notation === 'sci' ? 'short' : 'sci'; setNotation(x.settings.notation); })} />
        </label>
        {canInstall() && <button className="primary wide" onClick={installApp}>📲 Installer l'application</button>}
      </div>
      <div className="card">
        <h3>Sauvegarde</h3>
        <div className="btns">
          <button className="ghost" onClick={() => { navigator.clipboard?.writeText(exportSave(game.s)); setMsg('Sauvegarde copiée dans le presse-papier ✅'); }}>📋 Exporter</button>
          <button className="ghost" onClick={() => { saveNow(); setMsg('Partie sauvegardée ✅'); }}>💾 Sauver</button>
        </div>
        <textarea placeholder="Collez ici un code de sauvegarde ou de transfert…" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="ghost wide" onClick={async () => {
          try {
            const t = Cloud.parseTransfer(code);
            if (t && Cloud.cloudEnabled) {
              const raw = await Cloud.pull(t.id, t.secret);
              const st = importSave(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))));
              st.cloud = t;
              replaceState(st);
            } else replaceState(importSave(code));
            setMsg('Sauvegarde importée ✅');
          } catch { setMsg('Code invalide ❌'); }
        }}>📥 Importer</button>
        {s.cloud && (
          <div className="small">
            Code de transfert (pour jouer sur un autre appareil) :
            <code className="transfer" onClick={() => { navigator.clipboard?.writeText(Cloud.transferCode(s.cloud!)); setMsg('Code copié ✅'); }}>{Cloud.transferCode(s.cloud)}</code>
          </div>
        )}
        {msg && <div className="small pos">{msg}</div>}
      </div>
      <div className="card">
        {!resetAsk ? (
          <button className="danger wide" onClick={() => setResetAsk(true)}>🗑️ Effacer toute la progression</button>
        ) : (
          <div className="btns">
            <button className="ghost" onClick={() => setResetAsk(false)}>Annuler</button>
            <button className="danger" onClick={() => { clearLocal(); replaceState(newState()); setResetAsk(false); }}>Oui, tout effacer</button>
          </div>
        )}
      </div>
      <div className="small muted center">Stratos · L'usine à météo — v1.0</div>
    </>
  );
}
