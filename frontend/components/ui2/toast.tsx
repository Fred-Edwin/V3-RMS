'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useWdsToastStore, type WdsToastVariant } from '@/store/wdsToastStore'

/**
 * WDS Toast — no toast artboard exists in Paper (`V3-RMS` file, checked
 * 2026-09-23). Built against the design system's pre-allocated "raised · sm"
 * elevation tier (Tokens · Spacing/Radii/Elevation artboard: 4px radius,
 * shadow-wds-sm, white surface, wds-border) plus the existing success/
 * error/info semantic triads — owner-approved skipping a dedicated design
 * pass for this component (2026-09-23).
 *
 * Single active toast, not a stack — both current consumers (Goods Receipt
 * draft-save, Requisitions "Nudge head") are one-shot confirmations, not
 * event lists.
 */

const variantConfig: Record<
  WdsToastVariant,
  { classes: string; icon: React.ReactNode }
> = {
  success: {
    classes: 'border-l-wds-success-border',
    icon: <CheckCircle2 size={18} className="shrink-0 text-wds-success-fg" />,
  },
  error: {
    classes: 'border-l-wds-error-border',
    icon: <XCircle size={18} className="shrink-0 text-wds-error-fg" />,
  },
  info: {
    classes: 'border-l-wds-info-border',
    icon: <Info size={18} className="shrink-0 text-wds-info-fg" />,
  },
}

export interface ToastProps {
  id: string
  variant: WdsToastVariant
  title: string
  description?: string
  onClose: (id: string) => void
}

export function Toast({ id, variant, title, description, onClose }: ToastProps) {
  const config = variantConfig[variant]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex w-[340px] max-w-[calc(100vw-32px)] animate-in gap-3 rounded-wds-md border border-wds-border border-l-4 bg-wds-surface p-3 fade-in-0 slide-in-from-top-2 shadow-wds-sm motion-reduce:animate-none',
        config.classes
      )}
    >
      <div className="mt-0.5">{config.icon}</div>

      <div className="min-w-0 flex-1">
        <p className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{title}</p>
        {description && (
          <p className="mt-0.5 font-wds-sans text-wds-caption text-wds-text-copy-muted">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onClose(id)}
        aria-label="Dismiss"
        className="-mr-0.5 -mt-0.5 shrink-0 self-start rounded-wds-sm p-1 text-wds-text-copy-muted hover:bg-wds-neutral-100"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function WdsToastContainer() {
  const toast = useWdsToastStore((state) => state.toast)
  const removeToast = useWdsToastStore((state) => state.removeToast)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 items-center md:left-auto md:right-4 md:translate-x-0 md:items-end"
    >
      {toast && (
        <Toast
          key={toast.id}
          id={toast.id}
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
          onClose={removeToast}
        />
      )}
    </div>,
    document.body
  )
}
