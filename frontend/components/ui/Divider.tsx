import { cn } from '@/lib/cn'

interface DividerProps {
  label?: string
  className?: string
}

export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cn('border-stone-200', className)} />
  }

  return (
    <div role="separator" className={cn('flex items-center gap-0', className)}>
      <hr className="flex-1 border-stone-200" />
      <span className="text-label-sm text-stone-400 px-3">{label}</span>
      <hr className="flex-1 border-stone-200" />
    </div>
  )
}
