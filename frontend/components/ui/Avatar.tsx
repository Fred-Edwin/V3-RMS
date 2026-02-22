import { cn } from '@/lib/cn'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps {
  name: string
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-8 text-label-sm',
  md: 'size-10 text-label-md',
  lg: 'size-12 text-label-lg',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-espresso text-crema font-sans font-semibold shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}
