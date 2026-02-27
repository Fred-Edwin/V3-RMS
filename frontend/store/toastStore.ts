import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  message?: string
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
}

const generateToastId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const randomValues = new Uint32Array(4)
    globalThis.crypto.getRandomValues(randomValues)
    return Array.from(randomValues, (value) => value.toString(16).padStart(8, '0')).join('-')
  }

  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = generateToastId()
    set((state) => ({
      toasts: [{ ...toast, id }, ...state.toasts].slice(0, 3),
    }))
    return id
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))
