-- Stratos Tycoon : sauvegarde cloud + classement.
-- Aucun compte requis : chaque joueur reçoit un identifiant + un secret (seul son hash est stocké).
-- La table n'est accessible QUE via les fonctions ci-dessous (RLS activé, aucune policy).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tycoon_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 20),
  secret_hash text not null,
  save jsonb,
  total_earned double precision not null default 0,
  ether double precision not null default 0,
  prestiges integer not null default 0,
  achievements integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tycoon_players enable row level security;
revoke all on public.tycoon_players from anon, authenticated;

create index if not exists tycoon_players_rank_idx on public.tycoon_players (total_earned desc);

-- Inscription : renvoie l'identifiant et le secret (à conserver côté client).
create or replace function public.tycoon_register(p_name text)
returns table (id uuid, secret text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_secret text := encode(extensions.gen_random_bytes(24), 'hex');
  v_name text := btrim(p_name);
begin
  if v_name is null or char_length(v_name) < 3 or char_length(v_name) > 20 then
    raise exception 'Pseudo invalide (3 à 20 caractères)';
  end if;
  return query
    insert into public.tycoon_players as p (name, secret_hash)
    values (v_name, encode(extensions.digest(v_secret, 'sha256'), 'hex'))
    returning p.id, v_secret;
end;
$$;

-- Envoi de la sauvegarde + statistiques publiques.
create or replace function public.tycoon_push(
  p_id uuid, p_secret text, p_name text, p_save jsonb,
  p_total double precision, p_ether double precision, p_prestiges integer, p_ach integer
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if pg_column_size(p_save) > 300000 then
    raise exception 'Sauvegarde trop volumineuse';
  end if;
  update public.tycoon_players set
    name = case when char_length(v_name) between 3 and 20 then v_name else name end,
    save = p_save,
    total_earned = greatest(0, least(coalesce(p_total, 0), 1e300)),
    ether = greatest(0, coalesce(p_ether, 0)),
    prestiges = greatest(0, coalesce(p_prestiges, 0)),
    achievements = greatest(0, coalesce(p_ach, 0)),
    updated_at = now()
  where id = p_id and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
  if not found then
    raise exception 'Identifiants invalides';
  end if;
  return true;
end;
$$;

-- Récupération d'une sauvegarde (transfert entre appareils).
create or replace function public.tycoon_pull(p_id uuid, p_secret text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_save jsonb;
begin
  select save into v_save from public.tycoon_players
  where id = p_id and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
  if not found then
    raise exception 'Identifiants invalides';
  end if;
  return v_save;
end;
$$;

-- Classement public (ne révèle ni identifiant ni sauvegarde).
create or replace function public.tycoon_leaderboard(p_limit integer default 50)
returns table (rank bigint, name text, total_earned double precision, ether double precision, prestiges integer, achievements integer)
language sql security definer set search_path = public
stable
as $$
  select row_number() over (order by p.total_earned desc), p.name, p.total_earned, p.ether, p.prestiges, p.achievements
  from public.tycoon_players p
  where p.total_earned > 0
  order by p.total_earned desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.tycoon_register(text) from public;
revoke all on function public.tycoon_push(uuid, text, text, jsonb, double precision, double precision, integer, integer) from public;
revoke all on function public.tycoon_pull(uuid, text) from public;
revoke all on function public.tycoon_leaderboard(integer) from public;
grant execute on function public.tycoon_register(text) to anon, authenticated;
grant execute on function public.tycoon_push(uuid, text, text, jsonb, double precision, double precision, integer, integer) to anon, authenticated;
grant execute on function public.tycoon_pull(uuid, text) to anon, authenticated;
grant execute on function public.tycoon_leaderboard(integer) to anon, authenticated;
