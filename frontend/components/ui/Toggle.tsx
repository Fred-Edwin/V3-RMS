'use client'

import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[200ms] ease-standard motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-espresso' : 'bg-stone-300'
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-[200ms] ease-standard motion-reduce:transition-none',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )

  if (!label) {
    return <span className={className}>{button}</span>
  }

  return (
    <label className={cn('inline-flex items-center gap-3 cursor-pointer', disabled && 'cursor-not-allowed', className)}>
      {button}
      <span className="text-body-md text-stone-700 font-sans select-none">{label}</span>
    </label>
  )
}
