-- ============================================================================
-- Fauxto — schéma initial
--
-- Principes non négociables appliqués ici :
--   · RLS activé sur TOUTES les tables ;
--   · le solde de crédits n'est modifiable que par des fonctions
--     `security definer` transactionnelles — jamais par le client ;
--   · `credit_transactions.stripe_session_id` est UNIQUE : c'est ce qui rend
--     le webhook Stripe idempotent ;
--   · aucune adresse IP en clair : `anon_sessions.fingerprint` est un HMAC salé.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Profils ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  credits int not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

comment on column profiles.credits is
  'Solde de crédits. Modifiable UNIQUEMENT via grant_credits() / consume_credit(). '
  'La contrainte check(credits >= 0) est la dernière ligne de défense contre un solde négatif.';

-- Crée le profil dès l'inscription : sans ça, un utilisateur qui paie juste
-- après son magic link n'aurait pas de ligne à créditer.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits)
  values (new.id, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Sessions anonymes ───────────────────────────────────────────────────────
create table if not exists anon_sessions (
  id uuid primary key default gen_random_uuid(),
  -- HMAC-SHA256 salé de (IP + user-agent). JAMAIS l'IP en clair.
  fingerprint text not null,
  free_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- UNIQUE et pas seulement un index : c'est ce qui permet à
-- claim_free_generation() d'être atomique via ON CONFLICT. Sans l'unicité,
-- deux requêtes simultanées créeraient deux sessions et offriraient deux
-- générations gratuites pour la même empreinte.
create unique index if not exists anon_sessions_fingerprint_key
  on anon_sessions (fingerprint);

-- ── Générations ─────────────────────────────────────────────────────────────
create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  anon_session_id uuid references anon_sessions(id) on delete set null,
  template_id text not null,
  status text not null check (status in ('pending', 'done', 'failed')),
  provider text,
  model_id text,
  output_path text,
  watermarked boolean not null default true,
  cost_cents int,
  moderation_flag text,
  error_message text,
  -- Traçabilité du marquage AI Act : permet de prouver, ligne par ligne, que
  -- chaque image livrée portait bien ses trois couches.
  c2pa_applied boolean not null default false,
  c2pa_signer text,
  created_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '24 hours')
);

create index if not exists generations_user_id_idx on generations (user_id);
create index if not exists generations_anon_session_idx on generations (anon_session_id);
-- Index partiel : la purge ne balaie que ce qui reste à supprimer.
create index if not exists generations_purge_idx
  on generations (purge_after)
  where output_path is not null;
create index if not exists generations_created_at_idx on generations (created_at desc);

-- ── Mouvements de crédits ───────────────────────────────────────────────────
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  delta int not null,
  reason text not null,
  -- UNIQUE : garantit l'idempotence du webhook Stripe. Un rejeu du même
  -- événement viole la contrainte, la transaction est annulée, et le solde
  -- reste correct. C'est la seule protection dont on a besoin.
  stripe_session_id text unique,
  generation_id uuid references generations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on credit_transactions (user_id, created_at desc);

-- ── Signalements ────────────────────────────────────────────────────────────
-- Obligation du §7.4 : un signalement doit laisser une trace exploitable, pas
-- seulement une ligne de log qui disparaît au redéploiement.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  -- Catégorie : les deux premières passent en priorité absolue.
  reason text not null check (reason in (
    'minor', 'sexual_content', 'my_image', 'harassment', 'other'
  )),
  message text not null,
  -- Facultatif : le plaignant n'est pas forcément l'utilisateur du service.
  contact_email text,
  -- Identifiant de génération, si le plaignant a pu le fournir.
  generation_id uuid references generations(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on reports (status, created_at desc);

-- ============================================================================
-- FONCTIONS — seul chemin autorisé pour modifier un solde
-- ============================================================================

-- Réserve un crédit avant la génération.
--
-- Note d'implémentation importante : le cahier des charges demande de débiter
-- « après une génération réussie ». On applique son INTENTION (l'utilisateur ne
-- paie jamais un échec) avec une réservation puis un remboursement, plutôt
-- qu'un débit tardif. Raison : un débit après coup laisse une fenêtre de ~12 s
-- pendant laquelle deux requêtes parallèles peuvent lire le même solde et
-- générer deux images pour un seul crédit. La réservation atomique ferme cette
-- fenêtre, et `refund_credit()` garantit qu'un échec ne coûte rien.
create or replace function reserve_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update profiles
  set credits = credits - 1
  where id = p_user_id and credits > 0;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Confirme la consommation : enregistre le mouvement, le solde a déjà été
-- décrémenté par reserve_credit().
create or replace function confirm_credit(
  p_user_id uuid,
  p_generation_id uuid,
  p_reason text default 'generation'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into credit_transactions (user_id, delta, reason, generation_id)
  values (p_user_id, -1, p_reason, p_generation_id);
end;
$$;

-- Rend le crédit réservé quand la génération échoue.
create or replace function refund_credit(
  p_user_id uuid,
  p_generation_id uuid,
  p_reason text default 'refund_failed_generation'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set credits = credits + 1
  where id = p_user_id;

  -- Le mouvement net est nul : on trace la réservation et son annulation pour
  -- que l'historique reste lisible en cas de réclamation.
  insert into credit_transactions (user_id, delta, reason, generation_id)
  values (p_user_id, 0, p_reason, p_generation_id);
end;
$$;

-- Crédite un achat. Idempotent : un rejeu du webhook lève une violation
-- d'unicité sur stripe_session_id, et la fonction renvoie false sans rien
-- modifier.
create or replace function grant_credits(
  p_user_id uuid,
  p_delta int,
  p_reason text,
  p_stripe_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta <= 0 then
    raise exception 'grant_credits attend un delta strictement positif, reçu %', p_delta;
  end if;

  insert into credit_transactions (user_id, delta, reason, stripe_session_id)
  values (p_user_id, p_delta, p_reason, p_stripe_session_id);

  update profiles
  set credits = credits + p_delta
  where id = p_user_id;

  return true;
exception
  when unique_violation then
    -- Webhook déjà traité. Ce n'est pas une erreur : Stripe rejoue
    -- volontairement, et on doit répondre 200 pour qu'il arrête.
    return false;
end;
$$;

-- Consomme la génération gratuite d'une session anonyme, atomiquement.
create or replace function claim_free_generation(p_fingerprint text)
returns table (session_id uuid, granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Cas 1 : empreinte inconnue. L'insertion et la consommation sont un seul
  -- acte, donc deux requêtes simultanées ne peuvent pas toutes les deux gagner.
  insert into anon_sessions (fingerprint, free_used)
  values (p_fingerprint, true)
  on conflict (fingerprint) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  -- Cas 2 : empreinte connue et gratuité encore disponible. Le prédicat
  -- `free_used = false` dans le UPDATE rend la prise atomique.
  update anon_sessions
  set free_used = true
  where fingerprint = p_fingerprint and free_used = false
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  -- Cas 3 : déjà consommée. On renvoie l'identifiant pour pouvoir rattacher la
  -- tentative, mais sans accorder de génération.
  select id into v_id from anon_sessions where fingerprint = p_fingerprint;
  return query select v_id, false;
end;
$$;

-- Rend la gratuité si la génération anonyme a échoué : sans ça, un échec
-- serveur coûterait à l'utilisateur son unique essai gratuit.
create or replace function release_free_generation(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update anon_sessions
  set free_used = false
  where id = p_session_id;
end;
$$;

-- Preuve sociale de l'accueil. Lue depuis la base, jamais codée en dur.
create or replace function weekly_generation_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from generations
  where status = 'done'
    and created_at > now() - interval '7 days';
$$;

-- Liste ce que le cron doit supprimer du Storage, puis efface les lignes.
-- Renvoie les chemins pour que l'appelant supprime les fichiers d'abord :
-- l'inverse laisserait des fichiers orphelins impossibles à retrouver.
create or replace function expired_generation_paths(p_limit int default 500)
returns table (id uuid, output_path text)
language sql
security definer
set search_path = public
as $$
  select g.id, g.output_path
  from generations g
  where g.purge_after < now()
    and g.output_path is not null
  limit p_limit;
$$;

create or replace function mark_generations_purged(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update generations
  set output_path = null
  where id = any(p_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================================
-- RLS — activé partout, lecture limitée à ses propres lignes
-- ============================================================================

alter table profiles enable row level security;
alter table anon_sessions enable row level security;
alter table generations enable row level security;
alter table credit_transactions enable row level security;
alter table reports enable row level security;

-- reports : aucune policy. Les signalements ne sont ni lisibles ni modifiables
-- par les clients — un plaignant ne doit pas pouvoir consulter les
-- signalements d'autrui, ni un utilisateur signalé effacer celui qui le
-- concerne. L'insertion passe par le service role, via /api/report.

-- profiles : lecture de sa propre ligne uniquement. Aucune policy d'UPDATE :
-- le solde ne se modifie que par les fonctions ci-dessus.
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- anon_sessions : aucune policy. La table est donc totalement inaccessible aux
-- clés anon et authenticated — seul le service role y touche. C'est voulu :
-- une empreinte lisible côté client serait un vecteur de contournement.

-- generations : lecture de ses propres générations, pour l'historique.
drop policy if exists "generations_select_own" on generations;
create policy "generations_select_own" on generations
  for select using (auth.uid() = user_id);

-- credit_transactions : lecture de son propre historique.
drop policy if exists "credit_transactions_select_own" on credit_transactions;
create policy "credit_transactions_select_own" on credit_transactions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- DROITS D'EXÉCUTION
-- ============================================================================

-- Les fonctions sensibles ne sont appelables que par le service role.
revoke all on function reserve_credit(uuid) from public, anon, authenticated;
revoke all on function confirm_credit(uuid, uuid, text) from public, anon, authenticated;
revoke all on function refund_credit(uuid, uuid, text) from public, anon, authenticated;
revoke all on function grant_credits(uuid, int, text, text) from public, anon, authenticated;
revoke all on function claim_free_generation(text) from public, anon, authenticated;
revoke all on function release_free_generation(uuid) from public, anon, authenticated;
revoke all on function expired_generation_paths(int) from public, anon, authenticated;
revoke all on function mark_generations_purged(uuid[]) from public, anon, authenticated;

grant execute on function reserve_credit(uuid) to service_role;
grant execute on function confirm_credit(uuid, uuid, text) to service_role;
grant execute on function refund_credit(uuid, uuid, text) to service_role;
grant execute on function grant_credits(uuid, int, text, text) to service_role;
grant execute on function claim_free_generation(text) to service_role;
grant execute on function release_free_generation(uuid) to service_role;
grant execute on function expired_generation_paths(int) to service_role;
grant execute on function mark_generations_purged(uuid[]) to service_role;

-- Le compteur de preuve sociale est public : il n'expose qu'un agrégat.
grant execute on function weekly_generation_count() to anon, authenticated, service_role;

-- ============================================================================
-- STORAGE
-- ============================================================================
-- Bucket privé : les images ne sont servies que par URL signée à durée courte.
-- Une photo de visage est une donnée potentiellement biométrique — elle ne doit
-- jamais être accessible par URL devinable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generations', 'generations', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Aucune policy de storage pour anon/authenticated : tout passe par le service
-- role, qui génère des URL signées à la demande.
