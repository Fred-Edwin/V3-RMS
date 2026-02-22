import { cn } from '@/lib/cn'

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn('w-full px-4 md:px-6 lg:px-8 py-6', className)}>
      {children}
    </div>
  )
}
