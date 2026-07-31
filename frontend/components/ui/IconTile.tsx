import { cn } from '@/lib/cn'

type IconTileSize = 'sm' | 'md' | 'lg'

interface IconTileProps {
  icon: React.ElementType
  size?: IconTileSize
  className?: string
  iconClassName?: string
}

const sizeClasses: Record<IconTileSize, string> = {
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-11 h-11 rounded-lg',
  lg: 'w-14 h-14 rounded-xl',
}

const iconSizes: Record<IconTileSize, number> = {
  sm: 16,
  md: 20,
  lg: 26,
}

/**
 * Standardizes the "icon inside a soft square tile" pattern used for catalog
 * items, order types, and similar list rows — consolidates what was
 * previously copy-pasted inline with inconsistent sizing (SidebarNav,
 * NoticeDetailSheet, ConversationList each used a different size/shape).
 * Holds a generic Lucide icon for now; swap to a per-item-type custom icon
 * set later without touching call sites — only the `icon` prop changes.
 */
export function IconTile({ icon: Icon, size = 'md', className, iconClassName }: IconTileProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-parchment text-espresso',
        sizeClasses[size],
        className,
      )}
    >
      <Icon size={iconSizes[size]} className={cn('shrink-0', iconClassName)} />
    </div>
  )
}
