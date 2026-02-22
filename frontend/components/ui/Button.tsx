import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'lg' | 'md' | 'sm'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-sans font-medium rounded-md transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed select-none'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-espresso text-crema hover:bg-espresso-light active:scale-[0.98]',
  secondary:
    'bg-transparent text-espresso border-[1.5px] border-espresso hover:bg-stone-100 active:scale-[0.98]',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-100 active:bg-stone-200',
  destructive:
    'bg-transparent text-[#991B1B] border-[1.5px] border-[#FCA5A5] hover:bg-[#FEF2F2] active:scale-[0.98]',
}

const sizeClasses: Record<ButtonSize, string> = {
  lg: 'h-12 px-7 text-label-lg',
  md: 'h-11 px-6 text-label-lg',
  sm: 'h-9 px-4 text-label-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
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
        {isLoading ? (
          <Spinner size="sm" className={variant === 'primary' ? '[&>span:first-child]:border-t-crema [&>span:first-child]:border-crema/30' : ''} />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
