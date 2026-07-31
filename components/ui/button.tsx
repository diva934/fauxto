import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Toutes les variantes respectent la hauteur minimale de 48 px imposée par le
 * cahier des charges (`min-h-touch`), y compris `sm`.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-[transform,background-color,opacity] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 min-h-touch',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:bg-accent-dim',
        secondary: 'bg-surface-2 text-text hover:bg-line',
        outline: 'border border-line bg-transparent text-text hover:bg-surface',
        ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface',
        danger: 'bg-danger text-ink hover:opacity-90',
      },
      size: {
        sm: 'px-4 text-sm',
        md: 'px-6 text-base',
        lg: 'px-8 text-lg',
        // 56 px : assez présent pour un appel à l'action principal, sans le
        // pavé que faisaient les 64 px en pleine largeur sur un écran de
        // 390 px. Reste très au-dessus du minimum tactile de 48 px.
        xl: 'h-14 px-8 text-lg',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      // Sans `type`, un bouton dans un formulaire soumet par défaut : source
      // classique de soumissions accidentelles.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
