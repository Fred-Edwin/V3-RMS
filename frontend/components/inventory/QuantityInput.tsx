import { forwardRef } from 'react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/cn'

interface QuantityInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  /** e.g. "kg", "L", "pcs" — shown as a fixed suffix inside the field. */
  unit?: string
  label?: string
  errorMessage?: string
  inputClassName?: string
}

const DECIMAL_PATTERN = /^\d*\.?\d*$/

/**
 * Numeric entry for quantities/prices across Receiving, Prep entry, Stock
 * Count, and PO creation. A stepper (+/-) doesn't fit here — attendants
 * type exact measured/counted values (4.7kg, not built up one tap at a
 * time), so this is a plain decimal-keypad text field instead, following
 * the payroll sheet's numeric-cell convention (inputMode="decimal",
 * tabular-nums) adapted for a big mobile touch target rather than a dense
 * desktop grid cell.
 */
export const QuantityInput = forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ value, onValueChange, unit, label, errorMessage, className, inputClassName, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        label={label}
        errorMessage={errorMessage}
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
        rightIcon={unit ? <span className="text-label-md font-medium text-stone-500">{unit}</span> : undefined}
        className={className}
        inputClassName={cn('text-right tabular-nums text-body-lg font-semibold', inputClassName)}
        {...props}
      />
    )
  },
)

QuantityInput.displayName = 'QuantityInput'
