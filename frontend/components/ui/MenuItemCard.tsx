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
  const imageSrc = imageUrl ?? null
  const hasImage = imageSrc !== null

  return (
    <div
      className={cn(
        'relative bg-white border border-stone-200 shadow-sm rounded-md overflow-hidden transition-shadow duration-fast',
        isRecentlyAdded && 'border-amber shadow-md',
        !isAvailable && 'opacity-50',
        className
      )}
    >
      {imageSrc ? (
        <div className="relative h-40 bg-parchment">
          <Image
            src={imageSrc}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
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
      ) : null}

      {/* Content area */}
      <div className={cn('relative p-4 pb-12', !hasImage && 'pt-5')}>
        {!hasImage && (
          <Coffee
            size={30}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-4 top-4 text-[#D8CFC0]"
            aria-hidden="true"
          />
        )}
        {!hasImage && (quantity > 0 || !isAvailable || isRecentlyAdded) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 pr-10">
            {quantity > 0 && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-espresso px-1.5 py-0.5 text-caption text-crema">
                {quantity}
              </span>
            )}
            {!isAvailable && (
              <span className="rounded-full bg-stone-900 px-2 py-0.5 text-label-sm text-crema">
                Unavailable
              </span>
            )}
            {isRecentlyAdded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF3DC] px-2 py-1 text-caption text-espresso">
                <Check size={12} />
                Added
              </span>
            )}
          </div>
        )}

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
