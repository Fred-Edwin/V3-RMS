import { cn } from '@/lib/cn';

/**
 * WDS Skeleton — animated neutral sweep (not espresso; a coffee-tinted
 * shimmer would read as a bug). Falls back to a flat fill under
 * prefers-reduced-motion via the --wds-gradient-skeleton token.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-wds-sm bg-wds-gradient-skeleton bg-[length:200%_100%] animate-wds-skeleton',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
