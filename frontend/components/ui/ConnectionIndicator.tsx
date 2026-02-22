import { cn } from '@/lib/cn'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

interface ConnectionIndicatorProps {
  status: ConnectionStatus
  className?: string
}

const dotClasses: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500',
  reconnecting: 'bg-amber animate-pulse motion-reduce:animate-none',
  disconnected: 'bg-red-500',
}

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
}

export function ConnectionIndicator({ status, className }: ConnectionIndicatorProps) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      <span className={cn('size-2.5 rounded-full shrink-0', dotClasses[status])} />
      <span className="text-label-sm">{statusLabels[status]}</span>
      <span className="sr-only">Connection status: {statusLabels[status]}</span>
    </span>
  )
}
