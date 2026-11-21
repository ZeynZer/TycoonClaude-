// Effets visuels impératifs (hors React pour la performance).
let layer: HTMLDivElement | null = null;
function getLayer(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

export function spawnFloat(x: number, y: number, text: string, cls = ''): void {
  const el = document.createElement('div');
  el.className = `float-num ${cls}`;
  el.textContent = text;
  el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${y}px`;
  getLayer().appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function burst(x: number, y: number, n: number, emoji: string): void {
  const L = getLayer();
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'burst';
    el.textContent = emoji;
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 90;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    el.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    el.style.fontSize = `${12 + Math.random() * 14}px`;
    L.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

export function confetti(n = 80): void {
  const L = getLayer();
  const colors = ['#ff4d6d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffa94d'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    el.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 200}px`);
    L.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }
}

export function flyTo(fromEl: Element | null, toSelector: string, emoji: string): void {
  const to = document.querySelector(toSelector);
  if (!fromEl || !to) return;
  const a = fromEl.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly';
  el.textContent = emoji;
  el.style.left = `${a.left + a.width / 2}px`;
  el.style.top = `${a.top + a.height / 2}px`;
  el.style.setProperty('--tx', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
  el.style.setProperty('--ty', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
  getLayer().appendChild(el);
  setTimeout(() => el.remove(), 800);
}
