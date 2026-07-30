import { forwardRef, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  errorMessage?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  prefix?: string
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      prefix,
      inputClassName,
      className,
      id: providedId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = providedId ?? generatedId
    const hasError = !!errorMessage

    // rightIcon can be an arbitrary-width label (e.g. a unit suffix like
    // "pouch (500g)"), not just a small icon glyph — a fixed pr-10 overlaps
    // long labels with the input's own value. Measure it and reserve exactly
    // that much space instead.
    const rightIconRef = useRef<HTMLSpanElement>(null)
    const [rightIconWidth, setRightIconWidth] = useState(0)
    useLayoutEffect(() => {
      if (!rightIcon || !rightIconRef.current) {
        setRightIconWidth(0)
        return
      }
      setRightIconWidth(rightIconRef.current.offsetWidth)
    }, [rightIcon])

    const inputBase = cn(
      'w-full h-11 bg-parchment border-[1.5px] rounded-sm text-body-md font-sans text-stone-900 placeholder:text-stone-400 transition-colors duration-fast',
      'focus:outline-none focus:shadow-focus',
      hasError
        ? 'border-danger-border focus:border-danger-border'
        : 'border-stone-200 focus:border-espresso',
      disabled && 'bg-stone-100 opacity-50 cursor-not-allowed',
      leftIcon ? 'pl-10' : prefix ? 'pl-3' : 'px-3',
      !rightIcon && 'pr-3',
      inputClassName
    )

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
          <label
            htmlFor={id}
            className="text-label-sm font-medium text-stone-700"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-0 top-0 bottom-0 flex items-center px-3 text-body-sm text-stone-500 border-r border-stone-200 pointer-events-none">
              {prefix}
            </span>
          )}

          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${id}-error`
                : helperText
                  ? `${id}-helper`
                  : undefined
            }
            className={cn(inputBase)}
            style={rightIcon ? { paddingRight: rightIconWidth ? rightIconWidth + 20 : 40 } : undefined}
            {...props}
          />

          {rightIcon && (
            <span
              ref={rightIconRef}
              className="absolute right-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-stone-400 pointer-events-none"
            >
              {rightIcon}
            </span>
          )}
        </div>

        {hasError ? (
          <span
            id={`${id}-error`}
            role="alert"
            className="text-caption text-danger"
          >
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

Input.displayName = 'Input'
