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
  const { addToast, removeToast } = useToastStore()

  function toast(options: ToastOptions) {
    const id = addToast(options)
    const delay = dismissDelays[options.variant]
    if (delay !== null) {
      setTimeout(() => removeToast(id), delay)
    }
    return id
  }

  return { toast }
}
