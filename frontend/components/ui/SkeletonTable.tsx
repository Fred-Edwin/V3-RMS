import { cn } from '@/lib/cn'
import { SkeletonBlock } from './SkeletonBlock'

interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div aria-hidden="true" className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b-2 border-stone-200 mb-1">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBlock key={i} width="w-20" height="h-3" className="flex-1" />
        ))}
      </div>

      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 items-center h-[52px] border-b border-stone-100"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonBlock key={colIdx} width="w-full" height="h-4" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
