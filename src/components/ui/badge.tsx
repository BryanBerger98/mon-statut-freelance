import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:pointer-events-none disabled:opacity-50 transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/80 focus-visible:ring-destructive/20 dark:bg-destructive/60',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        // "Meilleur revenu" — solid Bleu France, white text (14.9:1). The winner reads
        // by saturation, in-palette (design decision "tout en Bleu France").
        winner: 'border-transparent bg-france text-white',
        // "Critère rempli" / net gains — positive token tint, never colour alone (pair with an icon at the call site).
        positive: 'border-transparent bg-positive/10 text-positive',
        // Caveat / threshold warning — attention token tint, never colour alone (pair with an icon at the call site).
        attention: 'border-transparent bg-attention/10 text-attention',
        // Back-compat aliases routed to brand tokens (were hard-coded emerald/amber).
        success: 'border-transparent bg-positive/10 text-positive',
        warning: 'border-transparent bg-attention/10 text-attention',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
