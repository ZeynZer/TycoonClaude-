const SUFFIX = ['', 'K', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td', 'Qn', 'Qd', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

let notation: 'short' | 'sci' = 'short';
export function setNotation(n: 'short' | 'sci'): void {
  notation = n;
}

/** Formate un grand nombre : 1,23 M, 45,6 Md, … puis aa, ab… au-delà. */
export function fmt(x: number, decimals = 2): string {
  if (!Number.isFinite(x)) return '∞';
  if (x < 0) return '-' + fmt(-x, decimals);
  if (x < 1000) {
    if (x < 10 && x % 1 !== 0) return x.toFixed(x < 1 ? 2 : 1).replace('.', ',');
    return Math.floor(x).toString();
  }
  const e = Math.floor(Math.log10(x) / 3);
  if (notation === 'sci') return x.toExponential(2).replace('.', ',').replace('e+', 'e');
  const m = x / Math.pow(1000, e);
  const digits = m >= 100 ? 0 : m >= 10 ? 1 : decimals;
  const num = (Math.floor(m * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits).replace('.', ',');
  let suf: string;
  if (e < SUFFIX.length) suf = SUFFIX[e];
  else {
    const k = e - SUFFIX.length;
    suf = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + (k % 26));
  }
  return `${num} ${suf}`;
}

export function money(x: number): string {
  return `${fmt(x)} $`;
}

export function qty(x: number): string {
  if (x > 0 && x < 0.01) return '<0,01';
  return fmt(x);
}

export function duration(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')}`;
  return `${s} s`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}
