import { cn } from '@/lib/cn'

export type BadgeVariant = 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled' | 'awaiting' | 'cancellationPending'
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral'
type BadgeSize = 'default' | 'lg'

interface BadgeProps {
  /** Order-status preset with a fixed label */
  variant?: BadgeVariant
  /** Semantic tone for custom labels — pair with `children` */
  tone?: BadgeTone
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
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

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success border border-success-border',
  warning: 'bg-warning-bg text-warning border border-warning-border',
  danger: 'bg-danger-bg text-danger border border-danger-border',
  neutral: 'bg-stone-100 text-stone-600 border border-stone-200',
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

export function Badge({ variant, tone, size = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variant ? variantClasses[variant] : toneClasses[tone ?? 'neutral'],
        sizeClasses[size],
        className
      )}
    >
      {children ?? (variant ? variantLabels[variant] : null)}
    </span>
  )
}
