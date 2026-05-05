import { cn } from '@/lib/cn';

interface PayslipStatusBadgeProps {
  isLocked: boolean;
  className?: string;
}

export function PayslipStatusBadge({ isLocked, className }: PayslipStatusBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
        isLocked ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-[#FFFBEB] text-[#92400E]',
        className,
      )}
    >
      {isLocked ? 'Locked' : 'Draft'}
    </span>
  );
}
