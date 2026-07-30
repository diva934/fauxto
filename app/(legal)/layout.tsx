import Link from 'next/link';
import { BRAND } from '@/lib/utils';

/**
 * Gabarit commun aux pages légales.
 *
 * Typographie plus dense que le reste du produit : ces pages se lisent, elles ne
 * se scannent pas. Elles restent en thème sombre pour ne pas dérouter, mais avec
 * une largeur de ligne confortable.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 safe-top safe-bottom">
      <header className="py-4">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center text-sm text-muted hover:text-text"
        >
          ← {BRAND.name}
        </Link>
      </header>

      <article
        className={[
          'flex-1 pb-12',
          '[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:mb-2',
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-2',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1',
          '[&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-muted [&_p]:mb-3',
          '[&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-muted',
          '[&_ul]:mb-3 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc',
          '[&_ol]:mb-3 [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:list-decimal',
          '[&_strong]:text-text [&_strong]:font-semibold',
          '[&_a]:text-accent [&_a]:underline',
          '[&_table]:w-full [&_table]:text-[14px] [&_table]:my-4',
          '[&_th]:text-left [&_th]:text-text [&_th]:font-semibold [&_th]:py-2 [&_th]:pr-3 [&_th]:align-top',
          '[&_td]:text-muted [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:border-t [&_td]:border-line',
        ].join(' ')}
      >
        {children}
      </article>

      {/* Cibles tactiles de 48 px minimum, y compris ici (§8). */}
      <nav className="flex flex-wrap items-center gap-x-1 border-t border-line py-2 text-xs text-muted">
        {[
          { href: '/mentions-legales', label: 'Mentions légales' },
          { href: '/confidentialite', label: 'Confidentialité' },
          { href: '/cgv', label: 'CGV' },
          { href: '/cgu', label: 'CGU' },
          { href: '/signaler', label: 'Signaler une image' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-touch items-center px-2 hover:text-text"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
