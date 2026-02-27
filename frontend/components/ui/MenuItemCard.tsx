'use client'

import Image from 'next/image'
import { Check, Coffee, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'
import { PriceDisplay } from './PriceDisplay'

interface MenuItemCardProps {
  name: string
  description?: string
  price: number
  isAvailable: boolean
  imageUrl?: string
  quantity?: number
  isRecentlyAdded?: boolean
  onAdd?: () => void
  className?: string
}

export function MenuItemCard({
  name,
  description,
  price,
  isAvailable,
  imageUrl,
  quantity = 0,
  isRecentlyAdded = false,
  onAdd,
  className,
}: MenuItemCardProps) {
  return (
    <div
      className={cn(
        'relative bg-white border border-stone-200 shadow-sm rounded-md overflow-hidden transition-shadow duration-fast',
        isRecentlyAdded && 'border-amber shadow-md',
        !isAvailable && 'opacity-50',
        className
      )}
    >
      {/* Image area */}
      <div className="relative h-40 bg-parchment">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-[#EDE2D0]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3),rgba(237,226,208,0))]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Coffee size={34} strokeWidth={1.5} className="text-[#C8B8A3]" aria-hidden="true" />
            </div>
          </>
        )}
        {!isAvailable && (
          <span className="absolute top-2 right-2 bg-stone-900/70 text-crema text-label-sm px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        )}
        {quantity > 0 && (
          <span className="absolute left-2 top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-espresso px-1.5 py-0.5 text-caption text-crema">
            {quantity}
          </span>
        )}
        {isRecentlyAdded && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-crema/95 px-2 py-1 text-caption text-espresso shadow-sm">
            <Check size={12} />
            Added
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="p-4 pb-12">
        <h3 className="text-heading-sm font-semibold text-stone-900 leading-snug">{name}</h3>
        {description && (
          <p className="text-body-sm text-stone-500 mt-1 line-clamp-2">{description}</p>
        )}
        <div className="mt-2">
          <PriceDisplay amount={price} />
        </div>
      </div>

      {isAvailable && onAdd && (
        <div className="absolute bottom-3 right-3">
          <IconButton
            icon={<Plus size={18} />}
            label="Add item"
            variant="primary"
            size="md"
            onClick={onAdd}
          />
        </div>
      )}
    </div>
  )
}
