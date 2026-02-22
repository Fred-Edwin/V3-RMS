import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

interface CardSectionProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className, onClick }: CardProps) {
  const isInteractive = !!onClick

  if (isInteractive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        className={cn(
          'bg-white border border-stone-200 shadow-md rounded-md cursor-pointer hover:shadow-lg transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-focus',
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={cn('bg-white border border-stone-200 shadow-md rounded-md', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-4 pt-4 pb-3 border-b border-stone-100', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-4 py-4', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-4 pt-3 pb-4 border-t border-stone-100', className)}>
      {children}
    </div>
  )
}
