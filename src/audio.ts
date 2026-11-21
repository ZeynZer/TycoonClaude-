// Effets sonores synthétisés (aucun fichier audio) + vibrations.
import { game } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!game.s.settings.sound) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, slide = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, filterFreq = 800, delay = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function vibrate(pattern: number | number[]): void {
  if (!game.s.settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}

export const sfx = {
  tap(combo: number) {
    tone(420 + Math.min(combo, 60) * 9, 0.08, 'triangle', 0.18);
    vibrate(6);
  },
  crit() {
    tone(880, 0.12, 'square', 0.12);
    tone(1320, 0.18, 'triangle', 0.15, 0.05);
    noise(0.25, 0.25, 2500);
    vibrate([10, 30, 20]);
  },
  buy() {
    tone(660, 0.07, 'triangle', 0.18);
    tone(990, 0.09, 'triangle', 0.15, 0.05);
  },
  cantBuy() {
    tone(180, 0.12, 'sawtooth', 0.08, 0, 0.7);
  },
  milestone() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.08));
    vibrate([20, 40, 20]);
  },
  upgrade() {
    tone(500, 0.1, 'sine', 0.2, 0, 2);
    tone(1000, 0.15, 'triangle', 0.12, 0.08);
  },
  sell() {
    tone(1200, 0.05, 'square', 0.08);
    tone(1600, 0.08, 'square', 0.06, 0.05);
    tone(2000, 0.12, 'triangle', 0.08, 0.1);
  },
  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.18, i * 0.1));
    vibrate([15, 30, 15, 30, 40]);
  },
  storm() {
    noise(1.2, 0.5, 400);
    tone(90, 0.8, 'sawtooth', 0.15, 0, 0.5);
    vibrate([50, 50, 100]);
  },
  bird() {
    tone(1800, 0.06, 'sine', 0.12);
    tone(2200, 0.08, 'sine', 0.12, 0.08);
    tone(1900, 0.06, 'sine', 0.1, 0.18);
  },
  reward() {
    [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, i * 0.06));
    vibrate([20, 20, 60]);
  },
  contract() {
    tone(523, 0.15, 'triangle', 0.18);
    tone(784, 0.25, 'triangle', 0.18, 0.12);
  },
  event() {
    tone(440, 0.15, 'sine', 0.14);
    tone(554, 0.15, 'sine', 0.14, 0.15);
  },
  prestige() {
    for (let i = 0; i < 12; i++) tone(300 + i * 90, 0.4, 'sine', 0.12, i * 0.07);
    noise(2, 0.25, 1200, 0.2);
    vibrate([30, 60, 30, 60, 200]);
  },
};
