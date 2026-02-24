import { cn } from '@/lib/cn'

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1280px] px-4 md:px-8 py-6', className)}>
      {children}
    </div>
  )
}
