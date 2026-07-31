import { Minus, Plus } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'

interface QuantityStepperProps {
  value: string
  onValueChange: (value: string) => void
  /** Amount +/- adjusts by. Defaults to 1. */
  step?: number
  /** Lowest allowed value. Defaults to 0 — decrement disables at this floor. */
  min?: number
  unit?: string
  className?: string
  inputClassName?: string
}

const DECIMAL_PATTERN = /^\d*\.?\d*$/

/**
 * +/- stepper with a manually-editable center field, for PO cart line
 * quantities — a deliberate departure from QuantityInput's plain-text-only
 * convention (see that component's doc comment): PO quantities can run into
 * the hundreds (e.g. napkins), where typing the number directly is faster,
 * but small adjustments (fixing a miscount, nudging by 1-2 units) are also
 * common enough that a stepper earns its place here. Not a replacement for
 * QuantityInput elsewhere — Receiving/Prep/Waste/Stock Count still use
 * exact-typed values only.
 */
export function QuantityStepper({
  value,
  onValueChange,
  step = 1,
  min = 0,
  unit,
  className,
  inputClassName,
}: QuantityStepperProps): JSX.Element {
  const numeric = parseFloat(value || '0')
  const atFloor = Number.isFinite(numeric) && numeric <= min

  const adjust = (delta: number) => {
    const current = Number.isFinite(numeric) ? numeric : 0
    const next = Math.max(min, current + delta)
    onValueChange(String(Number(next.toFixed(4))))
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <IconButton
        icon={<Minus size={14} />}
        label="Decrease quantity"
        variant="ghost"
        size="sm"
        disabled={atFloor}
        onClick={() => adjust(-step)}
      />
      <div className="relative flex h-9 w-20 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const next = e.target.value
            if (next === '' || DECIMAL_PATTERN.test(next)) {
              onValueChange(next)
            }
          }}
          className={cn(
            'h-full w-full bg-transparent text-center text-body-sm font-semibold tabular-nums text-stone-900 focus:outline-none',
            inputClassName,
          )}
        />
      </div>
      <IconButton
        icon={<Plus size={14} />}
        label="Increase quantity"
        variant="ghost"
        size="sm"
        onClick={() => adjust(step)}
      />
      {unit && <span className="min-w-0 truncate text-label-sm text-stone-500">{unit}</span>}
    </div>
  )
}
