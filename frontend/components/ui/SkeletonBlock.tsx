import { cn } from '@/lib/cn'

interface SkeletonBlockProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function SkeletonBlock({
  width = 'w-full',
  height = 'h-4',
  radius = 'rounded-md',
  className,
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none',
        width,
        height,
        radius,
        className
      )}
    />
  )
}
