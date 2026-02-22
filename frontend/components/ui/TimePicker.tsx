'use client'

import { forwardRef, useId } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'

interface TimePickerProps {
  value: string // 'HH:MM'
  onChange: (value: string) => void
  label?: string
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ value, onChange, label, min, max, disabled = false, className }, ref) => {
    const id = useId()

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
          <label htmlFor={id} className="text-label-sm font-medium text-stone-700">
            {label}
          </label>
        )}

        <div className="relative">
          <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            ref={ref}
            id={id}
            type="time"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'w-full h-11 bg-parchment border-[1.5px] border-stone-200 rounded-sm pl-10 pr-3 text-body-md font-sans text-stone-900',
              'focus:outline-none focus:border-espresso focus:shadow-focus transition-colors duration-fast',
              disabled && 'bg-stone-100 opacity-50 cursor-not-allowed'
            )}
          />
        </div>
      </div>
    )
  }
)

TimePicker.displayName = 'TimePicker'
