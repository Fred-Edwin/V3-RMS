import { cn } from '@/lib/cn'

interface StatCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  caption?: string
  className?: string
}

export function StatCard({ value, label, icon, caption, className }: StatCardProps) {
  return (
    <div className={cn('relative bg-white border border-stone-200 shadow-sm rounded-lg p-6', className)}>
      {icon && (
        <span className="absolute top-4 right-4 text-stone-400">
          {icon}
        </span>
      )}
      <p className="text-display-lg font-display font-medium text-stone-900">{value}</p>
      <p className="text-label-sm font-sans font-semibold uppercase tracking-wider text-stone-500 mt-1">
        {label}
      </p>
      {caption && (
        <p className="text-caption text-stone-500 mt-2">{caption}</p>
      )}
    </div>
  )
}
