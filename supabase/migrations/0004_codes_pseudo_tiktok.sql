-- ============================================================================
-- Fauxto — les codes acceptent les pseudos TikTok
--
-- POURQUOI. TikTok n'autorise pas de lien cliquable pour la plupart des
-- comptes : le créateur doit dicter l'adresse à l'oral dans sa vidéo. Or le
-- spectateur connaît déjà son pseudo — il vient de le lire sous la vidéo.
-- Une adresse qui le reprend telle quelle, `fauxto.online/leo.ktn`, n'ajoute
-- rien à mémoriser, là où `/r/leoktn` demande de retenir une convention en
-- plus ET de supprimer un point.
--
-- Les pseudos TikTok admettent le point et le tiret bas. L'ancienne contrainte
-- ne tolérait que lettres et chiffres, ce qui interdisait la majorité d'entre
-- eux.
--
-- Premier et dernier caractères alphanumériques : un code qui commence ou
-- finit par un point ressemble à une extension de fichier et se fait
-- intercepter en chemin.
-- ============================================================================

alter table partners drop constraint if exists partners_code_check;

alter table partners
  add constraint partners_code_check
  check (code ~ '^[a-z0-9][a-z0-9._]{2,22}[a-z0-9]$');

comment on column partners.code is
  'Code d''attribution, repris du pseudo du créateur. Minuscules, chiffres, point et tiret bas ; 4 à 24 caractères ; commence et finit par un caractère alphanumérique. Doit rester synchronisé avec CODE_PATTERN dans lib/partners.';

-- ============================================================================
