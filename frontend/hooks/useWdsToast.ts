import { useCallback } from 'react'
import { useWdsToastStore, type WdsToastVariant } from '@/store/wdsToastStore'

interface WdsToastOptions {
  variant: WdsToastVariant
  title: string
  description?: string
}

const dismissDelays: Record<WdsToastVariant, number | null> = {
  success: 3000,
  info: 3000,
  error: null, // manual close only
}

export function useWdsToast() {
  const addToast = useWdsToastStore((state) => state.addToast)
  const removeToast = useWdsToastStore((state) => state.removeToast)

  const toast = useCallback((options: WdsToastOptions): string => {
    const id = addToast(options)
    const delay = dismissDelays[options.variant]
    if (delay !== null) {
      setTimeout(() => removeToast(id), delay)
    }
    return id
  }, [addToast, removeToast])

  return { toast }
}
