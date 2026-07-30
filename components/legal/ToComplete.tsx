/**
 * Affiche une valeur, ou un marqueur voyant si elle manque.
 *
 * Le but est qu'un champ légal non renseigné soit IMPOSSIBLE à ne pas voir en
 * relisant la page. Un placeholder discret finit toujours en production.
 */
export function ToComplete({
  value,
  label,
}: {
  value: string | null | undefined;
  label: string;
}) {
  if (value) return <>{value}</>;

  return (
    <mark className="rounded bg-danger/20 px-1.5 py-0.5 font-semibold text-danger not-italic">
      [À COMPLÉTER : {label}]
    </mark>
  );
}
