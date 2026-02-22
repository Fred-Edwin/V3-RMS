import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'
import type { ButtonVariant } from './Button'

type IconButtonSize = 'lg' | 'md' | 'sm'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  variant?: ButtonVariant
  size?: IconButtonSize
  isLoading?: boolean
}

const baseClasses =
  'inline-flex items-center justify-center rounded-full transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed shrink-0'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-espresso text-crema hover:bg-espresso-light',
  secondary: 'bg-transparent text-espresso border-[1.5px] border-espresso hover:bg-stone-100',
  ghost: 'bg-transparent text-stone-700 hover:bg-stone-100 active:bg-stone-200',
  destructive: 'bg-transparent text-[#991B1B] border-[1.5px] border-[#FCA5A5] hover:bg-[#FEF2F2]',
}

const sizeClasses: Record<IconButtonSize, string> = {
  lg: 'size-12',
  md: 'size-11',
  sm: 'size-9',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? <Spinner size="sm" /> : icon}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
