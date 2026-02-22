'use client'

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'
import type { ToastVariant } from '@/store/toastStore'

interface ToastProps {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  onClose: (id: string) => void
}

// Full class strings for left border — no interpolation
const variantConfig: Record<ToastVariant, {
  border: string
  icon: React.ReactNode
}> = {
  success: {
    border: 'border-l-[#86EFAC]',
    icon: <CheckCircle2 size={18} className="text-[#1A6B3C] shrink-0" />,
  },
  error: {
    border: 'border-l-[#FCA5A5]',
    icon: <XCircle size={18} className="text-[#991B1B] shrink-0" />,
  },
  warning: {
    border: 'border-l-[#FCD34D]',
    icon: <AlertTriangle size={18} className="text-[#92400E] shrink-0" />,
  },
  info: {
    border: 'border-l-stone-300',
    icon: <Info size={18} className="text-stone-500 shrink-0" />,
  },
}

export function Toast({ id, variant, title, message, onClose }: ToastProps) {
  const config = variantConfig[variant]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'bg-white border border-stone-200 border-l-4 rounded-md shadow-lg p-3 flex gap-3 w-[340px] max-w-[calc(100vw-32px)] animate-slide-in-top motion-reduce:animate-none',
        config.border
      )}
    >
      <div className="mt-0.5">{config.icon}</div>

      <div className="flex-1 min-w-0">
        <p className="text-label-lg font-semibold text-stone-900">{title}</p>
        {message && (
          <p className="text-body-sm text-stone-600 mt-0.5">{message}</p>
        )}
      </div>

      <IconButton
        icon={<X size={14} />}
        label="Dismiss"
        variant="ghost"
        size="sm"
        onClick={() => onClose(id)}
        className="shrink-0 self-start -mt-0.5 -mr-0.5"
      />
    </div>
  )
}
