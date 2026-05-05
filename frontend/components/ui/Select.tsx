import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  label?: string
  placeholder?: string
  helperText?: string
  errorMessage?: string
  hasError?: boolean
  selectClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      label,
      placeholder,
      helperText,
      errorMessage,
      hasError: hasErrorProp,
      selectClassName,
      className,
      id: providedId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = providedId ?? generatedId
    const hasError = !!errorMessage || !!hasErrorProp
    const ungroupedOptions = options.filter((option) => !option.group)
    const groupedOptions = options.reduce<Map<string, SelectOption[]>>((groups, option) => {
      if (!option.group) return groups
      const existing = groups.get(option.group) ?? []
      existing.push(option)
      groups.set(option.group, existing)
      return groups
    }, new Map())

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
          <label htmlFor={id} className="text-label-sm font-medium text-stone-700">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined
            }
            className={cn(
              'w-full h-11 appearance-none bg-parchment border-[1.5px] rounded-sm pl-3 pr-10 text-body-md font-sans text-stone-900 transition-colors duration-fast',
              'focus:outline-none focus:shadow-focus',
              hasError
                ? 'border-[#FCA5A5] focus:border-[#FCA5A5]'
                : 'border-stone-200 focus:border-espresso',
              disabled && 'bg-stone-100 opacity-50 cursor-not-allowed',
              selectClassName
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {ungroupedOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
            {Array.from(groupedOptions.entries()).map(([group, groupItems]) => (
              <optgroup key={group} label={group}>
                {groupItems.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none"
          />
        </div>

        {hasError ? (
          <span id={`${id}-error`} role="alert" className="text-caption text-[#991B1B]">
            {errorMessage}
          </span>
        ) : helperText ? (
          <span id={`${id}-helper`} className="text-caption text-stone-500">
            {helperText}
          </span>
        ) : null}
      </div>
    )
  }
)

Select.displayName = 'Select'
