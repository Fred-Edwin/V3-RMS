import { cn } from '@/lib/cn'

export type BadgeVariant = 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled' | 'awaiting' | 'cancellationPending'
type BadgeSize = 'default' | 'lg'

interface BadgeProps {
  variant: BadgeVariant
  size?: BadgeSize
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-status-pending-bg text-status-pending-text border border-status-pending-border',
  inprogress: 'bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border',
  ready: 'bg-status-ready-bg text-status-ready-text border border-status-ready-border',
  closed: 'bg-status-closed-bg text-status-closed-text border border-status-closed-border',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text border border-status-cancelled-border',
  awaiting: 'bg-amber-50 text-amber-800 border border-amber-300',
  cancellationPending: 'bg-[#FFF7ED] text-[#9A3412] border border-[#FDBA74]',
}

const variantLabels: Record<BadgeVariant, string> = {
  pending: 'Pending',
  inprogress: 'In Progress',
  ready: 'Ready',
  closed: 'Closed',
  cancelled: 'Cancelled',
  awaiting: 'Awaiting Auth',
  cancellationPending: 'Cancel Pending',
}

const sizeClasses: Record<BadgeSize, string> = {
  default: 'text-label-sm px-2 py-0.5',
  lg: 'text-label-md px-3 py-1',
}

export function Badge({ variant, size = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {variantLabels[variant]}
    </span>
  )
}
