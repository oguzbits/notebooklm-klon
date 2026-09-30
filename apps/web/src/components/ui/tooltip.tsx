import { Tooltip as TooltipPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The tooltip of NotebookLM: the inverse surface of the page, small, without an arrow, there at once
 * (no delay), and 8px below the element. Each tooltip brings its own provider, so a component can use
 * one without the page having to wrap it.
 */
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = 'bottom',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-h-6 max-w-[200px] min-w-10 origin-(--radix-tooltip-content-transform-origin) rounded-[4px] bg-tooltip px-2 py-1 text-small leading-4 text-tooltip-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75 data-[state=delayed-open]:animate-in data-[state=delayed-open]:duration-150 data-[state=delayed-open]:ease-[cubic-bezier(0,0,0.2,1)] data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-80 data-[state=instant-open]:animate-in data-[state=instant-open]:duration-150 data-[state=instant-open]:ease-[cubic-bezier(0,0,0.2,1)] data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-80',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
