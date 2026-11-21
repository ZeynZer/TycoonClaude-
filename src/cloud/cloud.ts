// Sauvegarde cloud & classement via des fonctions RPC Supabase (aucune donnée perso requise).
import type { GameState } from '../game/state';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? '';

export const cloudEnabled = Boolean(URL && KEY);

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export interface LeaderRow {
  rank: number;
  name: string;
  total_earned: number;
  ether: number;
  prestiges: number;
  achievements: number;
  is_me?: boolean;
}

export async function register(name: string): Promise<{ id: string; secret: string }> {
  const rows = await rpc<{ id: string; secret: string }[]>('tycoon_register', { p_name: name });
  const r = Array.isArray(rows) ? rows[0] : (rows as any);
  if (!r?.id) throw new Error('Inscription impossible');
  return { id: r.id, secret: r.secret };
}

export async function push(s: GameState): Promise<void> {
  if (!s.cloud) return;
  const save = { ...s, cloud: null };
  await rpc<boolean>('tycoon_push', {
    p_id: s.cloud.id,
    p_secret: s.cloud.secret,
    p_name: s.settings.name,
    p_save: save,
    p_total: s.totalEarned,
    p_ether: s.etherClaimed,
    p_prestiges: s.stats.prestiges,
    p_ach: Object.keys(s.achievements).length,
  });
}

export async function pull(id: string, secret: string): Promise<unknown> {
  return rpc<unknown>('tycoon_pull', { p_id: id, p_secret: secret });
}

export async function leaderboard(): Promise<LeaderRow[]> {
  return rpc<LeaderRow[]>('tycoon_leaderboard', { p_limit: 50 });
}

/** Code de transfert : id + secret, à recopier sur un autre appareil. */
export function transferCode(c: { id: string; secret: string }): string {
  return `${c.id}.${c.secret}`;
}
export function parseTransfer(code: string): { id: string; secret: string } | null {
  const m = code.trim().match(/^([0-9a-f-]{36})\.([0-9a-f]{16,128})$/i);
  return m ? { id: m[1], secret: m[2] } : null;
}
