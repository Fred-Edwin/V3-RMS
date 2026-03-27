import { cn } from '@/lib/cn'

interface StatCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  caption?: string
  className?: string
  valueClassName?: string
  labelClassName?: string
}

export function StatCard({
  value,
  label,
  icon,
  caption,
  className,
  valueClassName,
  labelClassName,
}: StatCardProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {/* Top row: label left, icon right */}
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-label-sm font-semibold uppercase tracking-wider text-stone-400', labelClassName)}>
          {label}
        </p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            {icon}
          </span>
        )}
      </div>

      {/* Value + caption */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={cn('font-display text-display-md font-semibold leading-none text-espresso', valueClassName)}>
          {value}
        </p>
        {caption && (
          <p className="shrink-0 text-caption text-stone-400">{caption}</p>
        )}
      </div>
    </div>
  )
}
