-- ============================================================================
-- Fauxto — programme partenaire
--
-- Un partenaire partage un lien `/r/<code>`. On mesure trois choses, dans cet
-- ordre : les clics, les acheteurs venus de ces clics, et l'argent encaissé.
--
-- Principes repris du schéma initial, non négociables ici non plus :
--   · RLS activé sur TOUTES les tables ;
--   · les écritures passent par des fonctions `security definer` appelées par
--     le service role — un partenaire ne peut pas gonfler ses propres chiffres ;
--   · `partner_conversions.stripe_session_id` est UNIQUE : c'est ce qui rend
--     l'attribution idempotente, exactement comme `credit_transactions` ;
--   · aucune adresse IP en clair : `partner_clicks.visitor_hash` est le même
--     HMAC salé que celui déjà utilisé pour la limitation de débit.
-- ============================================================================

-- ── Partenaires ─────────────────────────────────────────────────────────────
-- Un partenaire EST un utilisateur du site. On ne crée pas un second système
-- d'authentification : il se connecte comme tout le monde, et la ligne
-- ci-dessous le rattache à un code de parrainage.
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  -- Code court, sensible à la casse d'affichage mais comparé en minuscules.
  code text not null unique check (code ~ '^[a-z0-9]{4,24}$'),
  display_name text,
  -- Part du montant encaissé qui revient au partenaire. Stockée par
  -- partenaire, et non codée en dur : renégocier un taux avec un créateur
  -- particulier ne doit pas demander un déploiement.
  commission_rate numeric(4, 3) not null default 0.200
    check (commission_rate >= 0 and commission_rate <= 1),
  created_at timestamptz not null default now()
);

comment on column partners.commission_rate is
  'Part du montant TTC encaissé reversée au partenaire. 0.200 = 20 %.';

-- ── Clics ───────────────────────────────────────────────────────────────────
-- Une ligne par visite via un lien partenaire. `visitor_hash` permet de
-- distinguer les visiteurs uniques des rechargements de page sans jamais
-- stocker d'IP.
create table if not exists partner_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  visitor_hash text,
  created_at timestamptz not null default now()
);

create index if not exists partner_clicks_partner_idx
  on partner_clicks (partner_id, created_at desc);

-- ── Conversions ─────────────────────────────────────────────────────────────
-- Une ligne par paiement abouti attribué à un partenaire. Le montant est celui
-- réellement encaissé, lu depuis Stripe — jamais recalculé depuis le pack, qui
-- pourrait changer de prix après coup.
create table if not exists partner_conversions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  -- UNIQUE : garantit qu'un rejeu du webhook Stripe n'attribue qu'une fois.
  -- Même mécanisme que credit_transactions.stripe_session_id.
  stripe_session_id text not null unique,
  amount_cents int not null check (amount_cents >= 0),
  -- Figée à l'instant de la vente. Si le taux du partenaire change plus tard,
  -- les commissions déjà dues ne doivent pas bouger rétroactivement.
  commission_cents int not null check (commission_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists partner_conversions_partner_idx
  on partner_conversions (partner_id, created_at desc);

-- ============================================================================
-- FONCTIONS
-- ============================================================================

-- Crée un partenaire pour un utilisateur, ou renvoie le sien s'il en a déjà un.
-- Idempotente : un double clic sur « devenir partenaire » ne crée pas deux
-- codes.
create or replace function create_partner(
  p_user_id uuid,
  p_code text,
  p_display_name text default null
)
returns table (partner_id uuid, code text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Variables locales plutôt qu'un %rowtype : `code` est à la fois une colonne
  -- de `partners` et un paramètre de SORTIE de cette fonction. Toute référence
  -- non qualifiée lèverait « column reference "code" is ambiguous » — à
  -- l'exécution seulement, pas à la création.
  v_id uuid;
  v_code text;
begin
  select p.id, p.code into v_id, v_code
  from partners p
  where p.user_id = p_user_id;

  if found then
    return query select v_id, v_code, false;
    return;
  end if;

  insert into partners (user_id, code, display_name)
  values (p_user_id, lower(p_code), nullif(trim(p_display_name), ''))
  returning partners.id, partners.code into v_id, v_code;

  return query select v_id, v_code, true;
exception
  when unique_violation then
    -- Collision de code, ou course entre deux requêtes simultanées. L'appelant
    -- retente avec un autre code ; s'il s'agissait d'une course, la ligne
    -- existe désormais et le prochain appel la renverra.
    return query select null::uuid, null::text, false;
end;
$$;

-- Enregistre un clic. Renvoie faux si le code n'existe pas — ce qui évite de
-- révéler à l'appelant la différence entre « code inconnu » et « échec ».
create or replace function record_partner_click(
  p_code text,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  select id into v_partner_id from partners where code = lower(p_code);
  if not found then
    return false;
  end if;

  insert into partner_clicks (partner_id, visitor_hash)
  values (v_partner_id, p_visitor_hash);

  return true;
end;
$$;

-- Attribue un paiement à un partenaire. La commission est calculée ici, à
-- partir du taux en vigueur au moment de la vente, puis figée.
create or replace function record_partner_conversion(
  p_code text,
  p_user_id uuid,
  p_stripe_session_id text,
  p_amount_cents int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner partners%rowtype;
begin
  select * into v_partner from partners where code = lower(p_code);
  if not found then
    return false;
  end if;

  -- Un partenaire ne touche pas de commission sur ses propres achats.
  if v_partner.user_id = p_user_id then
    return false;
  end if;

  insert into partner_conversions (
    partner_id, user_id, stripe_session_id, amount_cents, commission_cents
  )
  values (
    v_partner.id,
    p_user_id,
    p_stripe_session_id,
    p_amount_cents,
    floor(p_amount_cents * v_partner.commission_rate)::int
  );

  return true;
exception
  when unique_violation then
    -- Webhook rejoué. Comportement attendu, pas une erreur.
    return false;
end;
$$;

-- Tableau de bord d'un partenaire, en une seule requête.
create or replace function partner_stats(p_user_id uuid)
returns table (
  code text,
  commission_rate numeric,
  clicks bigint,
  unique_visitors bigint,
  conversions bigint,
  revenue_cents bigint,
  commission_cents bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.code,
    p.commission_rate,
    coalesce((select count(*) from partner_clicks c where c.partner_id = p.id), 0),
    coalesce((select count(distinct c.visitor_hash) from partner_clicks c
              where c.partner_id = p.id and c.visitor_hash is not null), 0),
    coalesce((select count(*) from partner_conversions v where v.partner_id = p.id), 0),
    coalesce((select sum(v.amount_cents) from partner_conversions v where v.partner_id = p.id), 0),
    coalesce((select sum(v.commission_cents) from partner_conversions v where v.partner_id = p.id), 0),
    p.created_at
  from partners p
  where p.user_id = p_user_id;
$$;

-- ============================================================================
-- RLS — activé partout
-- ============================================================================

alter table partners enable row level security;
alter table partner_clicks enable row level security;
alter table partner_conversions enable row level security;

-- partners : un partenaire lit sa propre ligne. Aucune policy d'INSERT ni
-- d'UPDATE — le code et le taux de commission ne se modifient pas depuis le
-- client, sans quoi n'importe qui se donnerait 100 %.
drop policy if exists "partners_select_own" on partners;
create policy "partners_select_own" on partners
  for select using (auth.uid() = user_id);

-- partner_clicks : aucune policy. Les clics ne sont lisibles que par
-- l'agrégat `partner_stats`. Exposer les lignes donnerait les horodatages
-- visite par visite, ce qui n'apporte rien au partenaire et fuite le trafic.

-- partner_conversions : lecture de ses propres conversions, pour justifier le
-- montant affiché. L'identité de l'acheteur n'est pas exposée par cette
-- policy seule, mais `user_id` y figure : on ne l'expose donc pas côté
-- application, où seul l'agrégat est lu.
drop policy if exists "partner_conversions_select_own" on partner_conversions;
create policy "partner_conversions_select_own" on partner_conversions
  for select using (
    exists (
      select 1 from partners p
      where p.id = partner_conversions.partner_id and p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- DROITS D'EXÉCUTION
-- ============================================================================

-- Toutes les écritures sont réservées au service role. Un partenaire qui
-- pourrait appeler `record_partner_click` depuis le navigateur gonflerait ses
-- statistiques à volonté ; `record_partner_conversion` s'inventerait des
-- ventes.
revoke all on function create_partner(uuid, text, text) from public, anon, authenticated;
revoke all on function record_partner_click(text, text) from public, anon, authenticated;
revoke all on function record_partner_conversion(text, uuid, text, int) from public, anon, authenticated;

grant execute on function create_partner(uuid, text, text) to service_role;
grant execute on function record_partner_click(text, text) to service_role;
grant execute on function record_partner_conversion(text, uuid, text, int) to service_role;

-- La lecture du tableau de bord est filtrée par `p_user_id`, mais la fonction
-- est `security definer` : on la réserve au service role, qui passe
-- l'identifiant issu de la session serveur. L'ouvrir à `authenticated`
-- laisserait n'importe qui lire les chiffres d'un autre en changeant
-- l'argument.
revoke all on function partner_stats(uuid) from public, anon, authenticated;
grant execute on function partner_stats(uuid) to service_role;

-- ============================================================================
