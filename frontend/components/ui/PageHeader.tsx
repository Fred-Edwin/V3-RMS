import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  titleClassName?: string
}

export function PageHeader({ title, subtitle, action, className, titleClassName }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between border-b border-stone-200 pb-4 mb-6', className)}>
      <div>
        <h1 className={cn('text-heading-xl font-sans font-semibold text-stone-900', titleClassName)}>{title}</h1>
        {subtitle && (
          <p className="text-body-md text-stone-500 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
