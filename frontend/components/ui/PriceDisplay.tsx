import { cn } from '@/lib/cn'

interface PriceDisplayProps {
  amount: number
  className?: string
}

export function PriceDisplay({ amount, className }: PriceDisplayProps) {
  const formatted = amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <span className={cn('text-label-lg text-espresso font-semibold', className)}>
      KES {formatted}
    </span>
  )
}
