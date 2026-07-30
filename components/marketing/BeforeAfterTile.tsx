import Image from 'next/image';
import Link from 'next/link';
import type { PrankTemplate } from '@/lib/templates';
import { cn } from '@/lib/utils';

/**
 * Vignette avant/après — l'élément qui vend le produit (§3.1).
 *
 * Historique de conception, parce que la première tentative était fausse :
 *
 * On a d'abord essayé un SPLIT DIAGONAL statique, en se disant qu'afficher les
 * deux états en permanence évitait de dépendre du timing d'une animation. En
 * pratique c'était pire : les deux images d'une paire ont par construction la
 * même composition (même personne, même cadre, même décor), donc la vignette se
 * lisait comme UNE seule photo barrée d'un trait. Le changement devenait
 * invisible, ce qui est exactement l'inverse du but.
 *
 * La solution retenue est un fondu, mais avec le LIBELLÉ SYNCHRONISÉ sur
 * l'image : à chaque instant, un seul badge est visible et il dit lequel des
 * deux états on regarde. On garde la lisibilité du changement (c'est le
 * mouvement qui la porte) sans l'ambiguïté du split.
 *
 * Sous `prefers-reduced-motion`, les animations sont neutralisées par
 * globals.css : la vignette se figera sur l'état « après » avec son badge, ce
 * qui reste correct et compréhensible.
 */
export function BeforeAfterTile({
  template,
  priority = false,
  className,
  delayMs = 0,
}: {
  template: PrankTemplate;
  priority?: boolean;
  className?: string;
  delayMs?: number;
}) {
  const delay = `${delayMs}ms`;

  return (
    <Link
      href={`/creer/${template.id}`}
      className={cn(
        'group relative block overflow-hidden rounded-card bg-surface',
        'aspect-4/5 ring-1 ring-line transition-[transform,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:ring-accent/50 active:scale-[0.99]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      aria-label={`${template.nameFr} — voir l’avant/après et choisir ce prank`}
    >
      {/* État « avant », toujours dessous */}
      <Image
        src={template.thumbnailBefore}
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 640px) 46vw, 230px"
        className="object-cover"
        priority={priority}
      />

      {/* État « après », révélé en boucle. Seul alt descriptif de la vignette :
          en mettre un sur les deux ferait lire deux fois la même chose. */}
      <Image
        src={template.thumbnailAfter}
        alt={`${template.nameFr} : avant et après transformation`}
        fill
        sizes="(max-width: 640px) 46vw, 230px"
        className="animate-reveal-after object-cover"
        style={{ animationDelay: delay }}
        priority={priority}
      />

      {/* Badges synchronisés sur la même timeline que l'image : quand l'un
          s'efface, l'autre apparaît. Jamais les deux ensemble. */}
      <span
        aria-hidden
        className="animate-label-before absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white/90 backdrop-blur-sm"
        style={{ animationDelay: delay }}
      >
        AVANT
      </span>
      <span
        aria-hidden
        className="animate-label-after absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-accent-ink"
        style={{ animationDelay: delay }}
      >
        APRÈS
      </span>

      {/* Dégradé pour garder le nom lisible quelle que soit l'image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 text-[13px] font-bold leading-tight text-white">
        {template.emoji} {template.nameFr}
      </p>
    </Link>
  );
}
