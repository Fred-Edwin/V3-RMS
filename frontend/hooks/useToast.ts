import { useCallback } from 'react'
import { useToastStore, type ToastVariant } from '@/store/toastStore'

interface ToastOptions {
  variant: ToastVariant
  title: string
  message?: string
}

const dismissDelays: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: null, // manual close only
}

export function useToast() {
  const addToast = useToastStore((state) => state.addToast)
  const removeToast = useToastStore((state) => state.removeToast)

  const toast = useCallback((options: ToastOptions): string => {
    const id = addToast(options)
    const delay = dismissDelays[options.variant]
    if (delay !== null) {
      setTimeout(() => removeToast(id), delay)
    }
    return id
  }, [addToast, removeToast])

  return { toast }
}
