'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastStore } from '@/store/toastStore'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 md:right-4 md:left-auto md:translate-x-0 md:items-end left-1/2 -translate-x-1/2 items-center"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          variant={toast.variant}
          title={toast.title}
          message={toast.message}
          onClose={removeToast}
        />
      ))}
    </div>,
    document.body
  )
}
