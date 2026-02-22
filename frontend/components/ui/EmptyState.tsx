import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: React.ReactNode
  heading: string
  body?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, heading, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center py-12 px-4', className)}>
      <span className="text-stone-300 mb-4">{icon}</span>
      <h3 className="text-heading-sm font-semibold text-stone-700">{heading}</h3>
      {body && (
        <p className="text-body-sm text-stone-500 mt-1 max-w-xs">{body}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  )
}
