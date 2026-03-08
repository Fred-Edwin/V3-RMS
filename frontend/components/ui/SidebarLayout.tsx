import { cn } from '@/lib/cn'

interface SidebarLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SidebarLayout({ sidebar, children, className }: SidebarLayoutProps) {
  return (
    <div className={cn('hidden lg:flex print:block min-h-screen bg-crema print:bg-white', className)}>
      <aside className="w-60 shrink-0 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen overflow-y-auto print:hidden">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0 print:block print:overflow-visible">
        {children}
      </main>
    </div>
  )
}
