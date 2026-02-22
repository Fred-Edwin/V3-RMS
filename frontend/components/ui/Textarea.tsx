import { forwardRef, useId } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  errorMessage?: string
  textareaClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      textareaClassName,
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

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
          <label htmlFor={id} className="text-label-sm font-medium text-stone-700">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          style={{ resize: 'vertical' }}
          className={cn(
            'w-full min-h-[88px] bg-parchment border-[1.5px] rounded-sm px-3 py-2 text-body-md font-sans text-stone-900 placeholder:text-stone-400 transition-colors duration-fast',
            'focus:outline-none focus:shadow-focus',
            hasError
              ? 'border-[#FCA5A5] focus:border-[#FCA5A5]'
              : 'border-stone-200 focus:border-espresso',
            disabled && 'bg-stone-100 opacity-50 cursor-not-allowed',
            textareaClassName
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea'
