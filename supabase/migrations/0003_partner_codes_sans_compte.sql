-- ============================================================================
-- Fauxto — codes partenaires sans compte
--
-- POURQUOI. `partners.user_id` était obligatoire : un partenaire devait donc
-- s'inscrire sur le site avant d'exister. Or le cas réel est l'inverse — on
-- contacte quatre influenceurs, on leur envoie un lien, et la plupart ne
-- créeront jamais de compte. Exiger l'inscription d'abord rendait le programme
-- inutilisable pour son usage principal.
--
-- Désormais un code peut exister seul. Il est créé par l'exploitant, mesuré
-- comme les autres, et pourra être rattaché plus tard à un compte si le
-- partenaire s'inscrit pour consulter ses chiffres lui-même.
-- ============================================================================

alter table partners alter column user_id drop not null;

comment on column partners.user_id is
  'Compte du partenaire. NULL pour un code créé par l''exploitant, que personne ne consulte encore.';

-- Crée un code nommé, sans compte associé. Réservé à l'exploitant.
--
-- Le code est FOURNI et non dérivé : pour un influenceur, le lien est lu à voix
-- haute dans une vidéo et tapé de mémoire par le spectateur. Il doit donc être
-- choisi, court, et coller au pseudo — pas suffixé d'aléatoire comme celui
-- qu'on génère pour une inscription en ligne.
create or replace function create_partner_code(
  p_code text,
  p_label text,
  p_commission_rate numeric default 0.200
)
returns table (partner_id uuid, code text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  select p.id, p.code into v_id, v_code from partners p where p.code = lower(p_code);

  if found then
    -- Idempotent : réutiliser le même code renvoie l'existant plutôt que
    -- d'échouer. Relancer la commande ne doit rien casser.
    return query select v_id, v_code, false;
    return;
  end if;

  insert into partners (user_id, code, display_name, commission_rate)
  values (null, lower(p_code), nullif(trim(p_label), ''), p_commission_rate)
  returning partners.id, partners.code into v_id, v_code;

  return query select v_id, v_code, true;
end;
$$;

revoke all on function create_partner_code(text, text, numeric) from public, anon, authenticated;
grant execute on function create_partner_code(text, text, numeric) to service_role;

-- Rattache un code existant à un compte, quand le partenaire finit par
-- s'inscrire pour suivre ses chiffres lui-même.
create or replace function claim_partner_code(p_code text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select p.user_id into v_owner from partners p where p.code = lower(p_code);
  if not found then
    return false;
  end if;

  -- Un code déjà rattaché ne change pas de main : sans ce garde-fou, quiconque
  -- connaît un code s'approprierait les commissions d'un autre.
  if v_owner is not null then
    return v_owner = p_user_id;
  end if;

  update partners set user_id = p_user_id where code = lower(p_code);
  return true;
end;
$$;

revoke all on function claim_partner_code(text, uuid) from public, anon, authenticated;
grant execute on function claim_partner_code(text, uuid) to service_role;

-- ============================================================================
