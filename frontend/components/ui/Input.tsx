import { forwardRef, useId } from 'react'
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

    const inputBase = cn(
      'w-full h-11 bg-parchment border-[1.5px] rounded-sm text-body-md font-sans text-stone-900 placeholder:text-stone-400 transition-colors duration-fast',
      'focus:outline-none focus:shadow-focus',
      hasError
        ? 'border-[#FCA5A5] focus:border-[#FCA5A5]'
        : 'border-stone-200 focus:border-espresso',
      disabled && 'bg-stone-100 opacity-50 cursor-not-allowed',
      leftIcon ? 'pl-10' : prefix ? 'pl-3' : 'px-3',
      rightIcon ? 'pr-10' : 'pr-3',
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
            className={cn(inputBase, prefix && 'pl-[calc(theme(spacing.3)*2+4ch)]')}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>

        {hasError ? (
          <span
            id={`${id}-error`}
            role="alert"
            className="text-caption text-[#991B1B]"
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
