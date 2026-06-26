import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const cardVariants = cva('text-card-foreground flex flex-col gap-6 rounded-2xl py-6', {
  variants: {
    variant: {
      // Glass partout (design decision): every card is a translucent glass surface.
      // The glass utilities own border + shadow; `prefers-reduced-transparency` swaps
      // them to opaque white via the --glass-* media query in global.css.
      default: 'glass-card',
      winner: 'glass-card-winner',
      quiet: 'glass-card-quiet',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardTitleVariants = cva('leading-none font-semibold', {
  variants: {
    variant: {
      default: '',
      // Results section heading — Archivo display at 18px (spec §4.4); every results <h2>.
      section: 'font-heading text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardContentVariants = cva('px-6', {
  variants: {
    size: {
      default: '',
      sm: 'text-sm',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

function Card({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardTitleVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return <Comp data-slot="card-title" className={cn(cardTitleVariants({ variant }), className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)} {...props} />
  );
}

function CardContent({ className, size, ...props }: React.ComponentProps<'div'> & VariantProps<typeof cardContentVariants>) {
  return <div data-slot="card-content" className={cn(cardContentVariants({ size }), className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center px-6 [.border-t]:pt-6', className)} {...props} />;
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardContentVariants,
  cardTitleVariants,
  cardVariants,
};
