import { cn } from '@/lib/cn'

export type BadgeVariant = 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled'
type BadgeSize = 'default' | 'lg'

interface BadgeProps {
  variant: BadgeVariant
  size?: BadgeSize
  className?: string
  label?: string
}

// Full class strings written out — no interpolation (Tailwind JIT requirement)
const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-[#FDF3DC] text-[#92650A] border border-[#F0D080]',
  inprogress: 'bg-[#FEF0E0] text-[#A04F0A] border border-[#F5B87A]',
  ready: 'bg-[#EDFAF1] text-[#1A6B3C] border border-[#86EFAC]',
  closed: 'bg-[#F4F4F5] text-[#71717A] border border-[#D4D4D8]',
  cancelled: 'bg-[#FDF2F0] text-[#9B3A2A] border border-[#F5A898]',
}

const variantLabels: Record<BadgeVariant, string> = {
  pending: 'Pending',
  inprogress: 'In Progress',
  ready: 'Ready',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

const sizeClasses: Record<BadgeSize, string> = {
  default: 'text-label-sm px-2 py-0.5',
  lg: 'text-label-md px-3 py-1',
}

export function Badge({ variant, size = 'default', className, label }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {label ?? variantLabels[variant]}
    </span>
  )
}
