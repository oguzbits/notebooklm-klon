import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-2xl border border-input bg-transparent px-4 py-1 text-ui transition-colors selection:bg-selected selection:text-selected-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-small file:font-label file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-foreground',
        'aria-invalid:border-destructive aria-invalid:outline-destructive',
        className
      )}
      {...props}
    />
  );
}

export { Input };
