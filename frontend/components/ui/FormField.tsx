import { cn } from '@/lib/cn'

interface FormFieldProps {
  label: string
  htmlFor: string
  helperText?: string
  errorMessage?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  helperText,
  errorMessage,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const hasError = !!errorMessage

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-label-md font-medium text-stone-700 block">
        {label}
        {required && (
          <span className="text-[#991B1B] ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {hasError ? (
        <span role="alert" className="text-caption text-[#991B1B]">
          {errorMessage}
        </span>
      ) : helperText ? (
        <span className="text-caption text-stone-500">{helperText}</span>
      ) : null}
    </div>
  )
}
