'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
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
  collapsed?: boolean
}

export function SidebarNav({ sections, activeHref, logo, className, collapsed }: SidebarNavProps) {
  return (
    <nav className={cn('flex flex-col h-full', className)}>
      {logo && !collapsed && (
        <div className="h-14 flex items-center px-4 border-b border-[#2C1810]/40 shrink-0">
          {logo}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-3">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className={sectionIdx > 0 ? 'mt-2' : ''}>
            {section.label && !collapsed && (
              <p className="text-label-sm font-semibold text-[#8B6B5A] uppercase tracking-wider px-4 mt-4 mb-1">
                {section.label}
              </p>
            )}
            <ul>
              {section.items.map((item) => {
                const isActive = activeHref === item.href || activeHref.startsWith(item.href + '/')
                const Icon = item.icon

                const badgeCount = item.badge ?? 0

                if (collapsed) {
                  return (
                    <li key={item.href} className="flex justify-center my-0.5">
                      <Link
                        href={item.href}
                        title={item.label}
                        className={cn(
                          'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-fast',
                          isActive
                            ? 'bg-[#2C1810] text-[#F5F0E8]'
                            : 'text-[#8B6B5A] hover:bg-[#2C1810]/60 hover:text-[#F5F0E8]'
                        )}
                      >
                        <Icon size={18} className="shrink-0" />
                        {badgeCount > 0 && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#9B3A2A]" />
                        )}
                      </Link>
                    </li>
                  )
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 h-10 mx-2 px-3 rounded-lg text-label-md font-medium transition-colors duration-fast',
                        isActive
                          ? 'bg-[#2C1810] text-[#F5F0E8]'
                          : 'text-[#C4B49A] hover:bg-[#2C1810]/60 hover:text-[#F5F0E8]'
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn('shrink-0', isActive ? 'text-[#F5F0E8]' : 'text-[#8B6B5A]')}
                      />
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#9B3A2A] px-1.5 text-[10px] font-bold leading-none text-white">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
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
