'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'

type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right' | 'bottom-end'

interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  placement?: PopoverPlacement
  className?: string
}

export function Popover({ trigger, children, placement = 'bottom', className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const panelPositionClasses: Record<PopoverPlacement, string> = {
    bottom: 'top-full left-0 mt-1',
    'bottom-end': 'top-full right-0 mt-1',
    top: 'bottom-full left-0 mb-1',
    right: 'left-full top-0 ml-1',
    left: 'right-full top-0 mr-1',
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen(o => !o)}>
        {trigger}
      </div>

      {open && (
        <div
          className={cn(
            'absolute bg-white rounded-md shadow-lg border border-stone-200 z-30 min-w-[160px] py-1',
            panelPositionClasses[placement],
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
