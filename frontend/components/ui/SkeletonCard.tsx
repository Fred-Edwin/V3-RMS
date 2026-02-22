import { cn } from '@/lib/cn'
import { SkeletonBlock } from './SkeletonBlock'

interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-white border border-stone-200 shadow-md rounded-md p-4 space-y-3', className)}
    >
      <SkeletonBlock width="w-1/2" height="h-5" />
      <SkeletonBlock width="w-full" height="h-4" />
      <SkeletonBlock width="w-4/5" height="h-4" />
      <SkeletonBlock width="w-full" height="h-16" />
    </div>
  )
}
