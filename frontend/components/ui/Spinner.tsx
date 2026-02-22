import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex', className)}>
      <span
        className={cn(
          'rounded-full border-2 border-stone-200 border-t-espresso animate-spin motion-reduce:animate-none',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">Loading</span>
    </span>
  )
}
