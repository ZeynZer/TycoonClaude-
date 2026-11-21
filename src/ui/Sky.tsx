import { useEffect, useRef } from 'react';
import { SEASONS } from '../game/data';
import { seasonIndex, seasonProgress } from '../game/economy';
import * as E from '../game/engine';
import { fmt } from '../game/format';
import { sfx } from '../audio';
import { act, game, useGame } from '../store';
import { spawnFloat, burst } from './fx';

type P = { x: number; y: number; vx: number; vy: number; life: number; kind: number; size: number };

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

function SkyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    const parts: P[] = [];
    const clouds = Array.from({ length: 9 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.45, s: 0.6 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.008, i }));
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6 }));
    let flash = 0;
    let bolt: { x: number; segs: [number, number][] } | null = null;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    let lastT = performance.now();

    const drawCloud = (x: number, y: number, s: number, alpha: number, color = '255,255,255') => {
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
      ctx.arc(x + 20 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
      ctx.arc(x + 44 * s, y, 18 * s, 0, Math.PI * 2);
      ctx.arc(x + 22 * s, y + 6 * s, 20 * s, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const s = game.s;
      const { steady } = E.snapshot(s);
      const pr = steady.flows.produced;
      const si = seasonIndex(s.time);
      const season = SEASONS[si];
      const nextSeason = SEASONS[(si + 1) % 4];
      const sp = seasonProgress(s.time);
      const blend = sp > 0.85 ? (sp - 0.85) / 0.15 : 0;
      const storm = s.buffs.stormUntil > s.time;
      const frenzy = s.buffs.frenzyUntil > s.time;
      // cycle jour/nuit de 4 minutes
      const day = (Math.sin((s.time / 240) * Math.PI * 2) + 1) / 2;
      const night = Math.max(0, 0.75 - day) / 0.75;

      const top = mix(season.sky[0], nextSeason.sky[0], blend);
      const bot = mix(season.sky[1], nextSeason.sky[1], blend);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // nuit
      ctx.fillStyle = `rgba(8,10,35,${night * 0.72 + (storm ? 0.35 : 0)})`;
      ctx.fillRect(0, 0, w, h);
      if (night > 0.2) {
        for (const st of stars) {
          ctx.fillStyle = `rgba(255,255,255,${(night - 0.2) * (0.5 + 0.5 * Math.sin(now / 600 + st.p))})`;
          ctx.fillRect(st.x * w, st.y * h, st.r, st.r);
        }
      }
      // aurores
      if (pr.aurore > 0) {
        const a = Math.min(1, 0.25 + Math.log10(1 + pr.aurore) * 0.25) * (0.35 + night * 0.65);
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 8) {
            const y = h * (0.18 + k * 0.07) + Math.sin(x / 70 + now / 1400 + k) * 16 + Math.sin(x / 23 + now / 900) * 5;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = k === 1 ? `rgba(160,110,255,${a * 0.6})` : `rgba(80,255,170,${a * 0.7})`;
          ctx.lineWidth = 14 - k * 3;
          ctx.shadowColor = '#6dffb0';
          ctx.shadowBlur = 18;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      // soleil
      if (pr.soleil > 0 || s.buildings.evap.n === 0) {
        const sx = w * 0.82, sy = h * (0.22 + night * 0.6);
        const rays = Math.min(16, 6 + Math.log10(1 + pr.soleil) * 3);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(now / 8000);
        ctx.fillStyle = `rgba(255,220,90,${0.25 * (1 - night)})`;
        for (let i = 0; i < rays; i++) {
          ctx.rotate((Math.PI * 2) / rays);
          ctx.beginPath();
          ctx.moveTo(0, -30);
          ctx.lineTo(6, -60);
          ctx.lineTo(-6, -60);
          ctx.fill();
        }
        ctx.restore();
        const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 30);
        sg.addColorStop(0, `rgba(255,250,200,${1 - night * 0.8})`);
        sg.addColorStop(1, `rgba(255,190,60,${0.9 - night * 0.8})`);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      // arc-en-ciel
      if (pr.arc > 0) {
        const a = Math.min(0.55, 0.18 + Math.log10(1 + pr.arc) * 0.15) * (0.7 + 0.3 * Math.sin(now / 1500));
        const cols = ['#ff4d4d', '#ff9f43', '#ffe066', '#5cd65c', '#4dabf7', '#7950f2'];
        cols.forEach((c, i) => {
          ctx.beginPath();
          ctx.strokeStyle = c;
          ctx.globalAlpha = a;
          ctx.lineWidth = 6;
          ctx.arc(w * 0.3, h * 1.05, h * 0.75 - i * 6, Math.PI, Math.PI * 2);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      // nuages de fond
      const nCloud = Math.min(9, 2 + Math.floor(Math.log10(1 + pr.nuage) * 2));
      for (const c of clouds) {
        if (c.i >= nCloud) continue;
        c.x += c.v * dt * (storm ? 4 : 1);
        if (c.x > 1.15) c.x = -0.25;
        const shade = storm ? '120,130,150' : night > 0.5 ? '180,190,220' : '255,255,255';
        drawCloud(c.x * w, c.y * h, c.s, 0.55 + c.s * 0.2, shade);
      }
      // éclairs
      const boltRate = (pr.eclair > 0 ? 0.04 + Math.log10(1 + pr.eclair) * 0.05 : 0) + (storm ? 1.2 : 0);
      if (Math.random() < boltRate * dt) {
        flash = 1;
        const x = Math.random() * w;
        const segs: [number, number][] = [[x, 0]];
        let cx = x, cy = 0;
        while (cy < h * 0.8) {
          cx += (Math.random() - 0.5) * 40;
          cy += 15 + Math.random() * 25;
          segs.push([cx, cy]);
        }
        bolt = { x, segs };
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,230,${flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
        if (bolt) {
          ctx.strokeStyle = `rgba(255,250,200,${flash})`;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#fff6a0';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          bolt.segs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        flash -= dt * 3;
      }
      // particules
      const spawn = (kind: number, rate: number) => {
        let n = rate * dt;
        while (n > 0) {
          if (Math.random() < n) {
            if (kind === 0) parts.push({ x: Math.random() * w, y: -10, vx: -40, vy: 420 + Math.random() * 200, life: 2, kind, size: 1 });
            else if (kind === 1) parts.push({ x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, life: 8, kind, size: 1.5 + Math.random() * 2.5 });
            else if (kind === 2) parts.push({ x: Math.random() * w, y: h, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 20, life: 3, kind, size: 6 + Math.random() * 10 });
            else parts.push({ x: Math.random() * w, y: Math.random() * h * 0.7, vx: 0, vy: -8, life: 1.5, kind, size: 2 });
          }
          n -= 1;
        }
      };
      if (pr.pluie > 0 || storm) spawn(0, Math.min(140, 10 + Math.log10(1 + pr.pluie) * 30) + (storm ? 120 : 0));
      if (pr.neige > 0) spawn(1, Math.min(40, 4 + Math.log10(1 + pr.neige) * 10));
      if (pr.vapeur > 0) spawn(2, Math.min(12, 1 + Math.log10(1 + pr.vapeur) * 2));
      if (frenzy) spawn(3, 40);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0 || p.y > h + 20 || p.y < -40) {
          parts.splice(i, 1);
          continue;
        }
        if (p.kind === 0) {
          ctx.strokeStyle = 'rgba(170,210,255,0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else if (p.kind === 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(p.x + Math.sin(p.y / 20) * 6, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 2) {
          ctx.fillStyle = `rgba(235,240,250,${(p.life / 3) * 0.35})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - p.life / 3), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,215,0,${p.life / 1.5})`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
      if (parts.length > 600) parts.splice(0, parts.length - 600);
      // ligne d'horizon de l'usine
      ctx.fillStyle = night > 0.5 ? '#0b1020' : 'rgba(20,28,50,0.85)';
      const base = h - 18;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const blocks = [0.04, 0.1, 0.18, 0.27, 0.35, 0.47, 0.56, 0.66, 0.75, 0.86, 0.94];
      ctx.lineTo(0, base);
      blocks.forEach((bx, i) => {
        const bh = 8 + ((i * 37) % 23);
        ctx.lineTo(bx * w, base);
        ctx.lineTo(bx * w, base - bh);
        ctx.lineTo(bx * w + 18, base - bh);
        if (i % 3 === 0) {
          ctx.lineTo(bx * w + 18, base - bh - 14);
          ctx.lineTo(bx * w + 24, base - bh - 14);
          ctx.lineTo(bx * w + 24, base - bh);
        }
        ctx.lineTo(bx * w + 30, base - bh);
        ctx.lineTo(bx * w + 30, base);
      });
      ctx.lineTo(w, base);
      ctx.lineTo(w, h);
      ctx.fill();
      // fenêtres allumées la nuit
      if (night > 0.3) {
        ctx.fillStyle = `rgba(255,210,120,${night * 0.8})`;
        blocks.forEach((bx, i) => {
          for (let k = 0; k < 3; k++) if ((i + k) % 2 === 0) ctx.fillRect(bx * w + 4 + k * 8, base - 6, 3, 3);
        });
      }
      if (frenzy) {
        ctx.fillStyle = 'rgba(255,200,0,0.08)';
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="sky-canvas" />;
}

export function Sky() {
  const s = useGame();
  const need = E.pressureNeeded(s);
  const storm = s.buffs.stormUntil > s.time;
  const stormLeft = Math.max(0, s.buffs.stormUntil - s.time);
  const birdActive = s.bird.activeUntil > s.time;
  const cloudRef = useRef<HTMLButtonElement>(null);

  const onTap = (e: React.PointerEvent) => {
    const r = act((st) => E.tap(st));
    const x = e.clientX, y = e.clientY;
    spawnFloat(x, y - 10, `+${fmt(r.value)} $`, r.crit ? 'crit' : storm ? 'storm' : '');
    if (r.crit) {
      sfx.crit();
      burst(x, y, 14, '⚡');
    } else sfx.tap(s.pressure);
    if (r.storm) {
      sfx.storm();
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 600);
    }
    const el = cloudRef.current;
    if (el) {
      el.classList.remove('squish');
      void el.offsetWidth;
      el.classList.add('squish');
    }
  };

  const onBird = (e: React.PointerEvent) => {
    e.stopPropagation();
    const res = act((st) => E.catchBird(st));
    if (!res) return;
    sfx.reward();
    burst(e.clientX, e.clientY, 22, '✨');
  };

  const ratio = storm ? stormLeft / (15 + 5 * (s.etherUpg.storm || 0)) : s.pressure / need;
  return (
    <div className={`sky ${storm ? 'is-storm' : ''}`}>
      <SkyCanvas />
      <button ref={cloudRef} className="tap-cloud" onPointerDown={onTap} aria-label="Taper sur le nuage">
        <svg viewBox="0 0 200 130" className="cloud-svg">
          <defs>
            <radialGradient id="cg" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor={storm ? '#8892b0' : '#cfe3ff'} />
            </radialGradient>
          </defs>
          <path d="M50 110 Q10 110 14 80 Q16 55 45 55 Q50 22 85 22 Q115 18 125 45 Q140 30 160 42 Q185 50 182 78 Q195 110 160 110 Z" fill="url(#cg)" stroke="rgba(255,255,255,.9)" strokeWidth="3" />
          <circle cx="78" cy="72" r="6" fill="#2b3a67" />
          <circle cx="122" cy="72" r="6" fill="#2b3a67" />
          <circle cx="80" cy="70" r="2" fill="#fff" />
          <circle cx="124" cy="70" r="2" fill="#fff" />
          <path d={storm ? 'M86 92 Q100 84 114 92' : 'M86 88 Q100 100 114 88'} stroke="#2b3a67" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="66" cy="86" rx="8" ry="4" fill="#ff9fb2" opacity=".6" />
          <ellipse cx="134" cy="86" rx="8" ry="4" fill="#ff9fb2" opacity=".6" />
        </svg>
        <div className="pressure">
          <div className={`pressure-fill ${storm ? 'storm' : ''}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          <span>{storm ? `🌪️ TEMPÊTE ×3 — ${Math.ceil(stormLeft)} s` : `Pression ${Math.floor(s.pressure)}/${need}`}</span>
        </div>
      </button>
      {birdActive && (
        <button key={s.bird.spawnedAt} className="bird" style={{ top: `${s.bird.y * 100}%` }} onPointerDown={onBird} aria-label="Oiseau-tonnerre">
          <span>🐦</span><i>⚡</i>
        </button>
      )}
    </div>
  );
}
