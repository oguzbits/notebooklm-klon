import { cn } from '@/lib/utils';

/** A placeholder that shimmers. Give it the size and shape of what will be there. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('shimmer rounded-[4px]', className)} {...props} />;
}

export { Skeleton };
