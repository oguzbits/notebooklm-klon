import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-ui font-label whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        destructive: 'bg-destructive text-background hover:opacity-90',
        outline: 'veil border border-border bg-transparent text-foreground',
        secondary: 'veil bg-secondary text-secondary-foreground',
        /** The soft blue action, used once per page. */
        prominent: 'veil bg-prominent text-prominent-foreground',
        ghost: 'veil',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 has-[>svg]:pr-3 has-[>svg]:pl-2',
        xs: "h-7 gap-1 px-3 text-small has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: 'h-10 px-6 has-[>svg]:px-5',
        xl: 'h-12 px-5 has-[>svg]:pr-4 has-[>svg]:pl-3',
        icon: 'size-9',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-4",
        'icon-sm': "size-8 [&_svg:not([class*='size-'])]:size-5",
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  tooltip,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** The short text of the tooltip; icon-only buttons should always have one. */
    tooltip?: string;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
