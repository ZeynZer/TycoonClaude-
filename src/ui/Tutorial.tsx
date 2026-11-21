import type { GameState } from '../game/state';
import { act, useGame } from '../store';

interface Step {
  text: string;
  done: (s: GameState) => boolean;
  go?: string;
  goLabel?: string;
}

const STEPS: Step[] = [
  { text: '☁️ Bienvenue chez Stratos, l’usine à météo ! Tapez sur le nuage pour gagner vos premiers dollars.', done: (s) => s.stats.taps >= 6 },
  { text: '♨️ Achetez votre premier Évaporateur : il produit de la vapeur, vendue automatiquement.', done: (s) => s.buildings.evap.n >= 1, go: 'factory', goLabel: 'Usine' },
  { text: '📈 Montez à 10 Évaporateurs : le palier 10 double leur vitesse !', done: (s) => s.buildings.evap.n >= 10, go: 'factory', goLabel: 'Usine' },
  { text: '🧊 Le Condenseur transforme 4 vapeurs en 1 nuage, bien plus rentable. Achetez-en un !', done: (s) => s.buildings.cond.n >= 1, go: 'factory', goLabel: 'Usine' },
  { text: '📉 Attention à la saturation : plus vous vendez un bien, plus son prix baisse. Jetez un œil à la Bourse.', done: (s) => s.settings.tutorial > 4, go: 'market', goLabel: 'Voir le marché' },
  { text: '🔧 Les améliorations doublent rendements et prix. Achetez-en une dès que possible !', done: (s) => Object.keys(s.upgrades).length >= 1, go: 'upgrades', goLabel: 'Améliorations' },
  { text: '🌪️ Tapez vite pour remplir la jauge de pression et déclencher une Tempête (×3 pendant 15 s). Et guettez l’Oiseau-tonnerre !', done: (s) => s.stats.storms >= 1 || s.stats.birds >= 1 },
  { text: '📜 Des clients proposent des contrats très lucratifs. Acceptez-en un !', done: (s) => s.contracts.some((c) => c.accepted) || s.stats.contracts > 0, go: 'contracts', goLabel: 'Contrats' },
];

export function Tutorial({ onGo }: { onGo: (tab: string) => void }) {
  const s = useGame();
  const i = s.settings.tutorial;
  if (i >= STEPS.length) return null;
  const step = STEPS[i];
  if (step.done(s)) {
    queueMicrotask(() => act((x) => { if (x.settings.tutorial === i) x.settings.tutorial = i + 1; }));
    return null;
  }
  return (
    <div className="tuto">
      <div className="tuto-text">{step.text}</div>
      <div className="btns">
        <button className="ghost tiny" onClick={() => act((x) => { x.settings.tutorial = STEPS.length; })}>Passer</button>
        {step.go && (
          <button
            className="primary small"
            onClick={() => {
              onGo(step.go!);
              if (i === 4) act((x) => { x.settings.tutorial = 5; });
            }}
          >
            {step.goLabel}
          </button>
        )}
      </div>
      <div className="tuto-step tiny muted">{i + 1}/{STEPS.length}</div>
    </div>
  );
}
