'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

interface DatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (value: string) => void
  label?: string
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  // 0=Sun..6=Sat; we want 0=Mon..6=Sun
  const day = new Date(year, month, 1).getDay()
  return (day + 6) % 7
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function DatePicker({ value, onChange, label, min, max, disabled = false, className }: DatePickerProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : today.getMonth())
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

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startOffset = firstDayOfMonth(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const iso = toISO(viewYear, viewMonth, day)
    onChange(iso)
    setOpen(false)
  }

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-label-sm font-medium text-stone-700">
          {label}
        </label>
      )}

      {/* Mobile: native date input */}
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'md:hidden w-full h-11 bg-parchment border-[1.5px] border-stone-200 rounded-sm px-3 text-body-md font-sans text-stone-900',
          'focus:outline-none focus:border-espresso focus:shadow-focus',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />

      {/* Desktop: custom calendar */}
      <div className="hidden md:block relative">
        <div className="relative">
          <input
            type="text"
            readOnly
            value={value || ''}
            placeholder="Select date"
            disabled={disabled}
            onClick={() => !disabled && setOpen(o => !o)}
            className={cn(
              'w-full h-11 bg-parchment border-[1.5px] border-stone-200 rounded-sm pl-10 pr-3 text-body-md font-sans text-stone-900 placeholder:text-stone-400 cursor-pointer',
              'focus:outline-none focus:border-espresso focus:shadow-focus',
              open && 'border-espresso shadow-focus',
              disabled && 'bg-stone-100 opacity-50 cursor-not-allowed'
            )}
          />
          <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        </div>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-md shadow-lg border border-stone-200 p-3 w-64">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <IconButton icon={<ChevronLeft size={14} />} label="Previous month" size="sm" variant="ghost" onClick={prevMonth} />
              <span className="text-label-md font-semibold text-stone-900">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <IconButton icon={<ChevronRight size={14} />} label="Next month" size="sm" variant="ghost" onClick={nextMonth} />
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <span key={d} className="text-center text-caption font-semibold text-stone-400 py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: startOffset }).map((_, i) => (
                <span key={`empty-${i}`} />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const iso = toISO(viewYear, viewMonth, day)
                const isSelected = iso === value
                const isToday = iso === todayISO
                const isDisabled = (min && iso < min) || (max && iso > max)

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!!isDisabled}
                    onClick={() => selectDay(day)}
                    className={cn(
                      'h-8 w-full flex items-center justify-center text-body-sm rounded-md transition-colors duration-fast',
                      isSelected && 'bg-espresso text-crema',
                      !isSelected && isToday && 'font-semibold text-amber',
                      !isSelected && !isToday && 'text-stone-700 hover:bg-stone-100',
                      isDisabled && 'opacity-30 cursor-not-allowed'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
