import { cn } from '@/lib/cn'
import { Avatar } from './Avatar'

interface StaffCardProps {
  name: string
  role: string
  isActive: boolean
  className?: string
}

export function StaffCard({ name, role, isActive, className }: StaffCardProps) {
  return (
    <div className={cn('bg-white border border-stone-200 shadow-sm rounded-md p-4 flex items-center gap-3', className)}>
      <div className="relative shrink-0">
        <Avatar name={name} size="md" />
        <span
          className={cn(
            'absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white',
            isActive ? 'bg-green-500' : 'bg-stone-300'
          )}
        />
      </div>

      <div className="min-w-0">
        <p className="text-label-lg font-semibold text-stone-900 truncate">{name}</p>
        <p className="text-label-sm text-stone-500 mt-0.5">{role}</p>
      </div>
    </div>
  )
}
