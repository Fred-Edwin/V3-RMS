import { cn } from '@/lib/cn'

interface SidebarLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SidebarLayout({ sidebar, children, className }: SidebarLayoutProps) {
  return (
    <div className={cn('flex min-h-screen bg-crema', className)}>
      <aside className="w-60 shrink-0 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
