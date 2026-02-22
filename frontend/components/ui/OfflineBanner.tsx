'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine)

    function handleOffline() { setIsOffline(true) }
    function handleOnline() { setIsOffline(false) }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[70] bg-[#FFFBEB] text-[#92400E] border-b border-[#FCD34D] h-10 flex items-center justify-center gap-2 animate-slide-in-top motion-reduce:animate-none"
    >
      <WifiOff size={16} />
      <span className="text-label-md font-medium">You&apos;re offline — check your connection</span>
    </div>
  )
}
