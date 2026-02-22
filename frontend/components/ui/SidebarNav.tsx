'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

interface SidebarNavProps {
  sections: NavSection[]
  activeHref: string
  logo?: React.ReactNode
  className?: string
}

export function SidebarNav({ sections, activeHref, logo, className }: SidebarNavProps) {
  return (
    <nav className={cn('flex flex-col h-full', className)}>
      {logo && (
        <div className="h-16 flex items-center px-4 border-b border-stone-200 shrink-0">
          {logo}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-3">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className={sectionIdx > 0 ? 'mt-2' : ''}>
            {section.label && (
              <p className="text-label-sm font-semibold text-stone-400 uppercase tracking-wider px-4 mt-4 mb-1">
                {section.label}
              </p>
            )}
            <ul>
              {section.items.map((item) => {
                const isActive = activeHref === item.href || activeHref.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 h-10 mx-2 px-4 rounded-md text-label-md font-medium transition-colors duration-fast',
                        isActive
                          ? 'bg-stone-100 text-espresso border-l-2 border-espresso pl-[14px]'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn('shrink-0', isActive ? 'text-espresso' : 'text-stone-500')}
                      />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
