import { create } from 'zustand'

export type WdsToastVariant = 'success' | 'error' | 'info'

export interface WdsToastItem {
  id: string
  variant: WdsToastVariant
  title: string
  description?: string
}

interface WdsToastStore {
  toast: WdsToastItem | null
  addToast: (toast: Omit<WdsToastItem, 'id'>) => string
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

  return `wds-toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useWdsToastStore = create<WdsToastStore>((set) => ({
  toast: null,
  addToast: (toast) => {
    const id = generateToastId()
    set({ toast: { ...toast, id } })
    return id
  },
  removeToast: (id) => {
    set((state) => (state.toast?.id === id ? { toast: null } : state))
  },
}))
