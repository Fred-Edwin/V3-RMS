import { cn } from '@/lib/cn'

interface FullscreenLayoutProps {
  children: React.ReactNode
  className?: string
}

export function FullscreenLayout({ children, className }: FullscreenLayoutProps) {
  return (
    <div className={cn('relative min-h-screen w-full flex flex-col bg-stone-900 overflow-hidden', className)}>
      {children}
    </div>
  )
}
