import { cn } from '@/lib/cn'

interface SidebarLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
  collapsedSidebar?: boolean
  sidebarClassName?: string
}

export function SidebarLayout({ sidebar, children, className, collapsedSidebar, sidebarClassName }: SidebarLayoutProps) {
  return (
    <div className={cn('hidden lg:flex print:block min-h-screen bg-crema print:bg-white', className)}>
      <aside className={cn(
        'shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto print:hidden transition-all duration-300',
        collapsedSidebar ? 'w-16' : 'w-60',
        sidebarClassName ?? 'bg-white border-r border-stone-200',
      )}>
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0 print:block print:overflow-visible">
        {children}
      </main>
    </div>
  )
}
