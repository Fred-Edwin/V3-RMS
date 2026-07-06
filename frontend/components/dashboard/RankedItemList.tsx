'use client'

export interface RankedItem {
  menuItemId: string
  name: string
  categoryName?: string
  revenue: string
  quantitySold: number
}

interface RankedItemListProps {
  items: RankedItem[]
  /** `top` — espresso rank chips; `bottom` — danger-tinted rank chips */
  variant?: 'top' | 'bottom'
  formatCurrency: (value: string | number) => string
}

/**
 * Compact ranked leaderboard (rank chip · name · revenue/qty) used for
 * top/bottom item performance on dashboards. Deliberately a soft list, not
 * a table — see ui-migration decisions in docs/context/UI_SYSTEM_ROADMAP.md.
 */
export function RankedItemList({ items, variant = 'top', formatCurrency }: RankedItemListProps) {
  const chipClass =
    variant === 'top'
      ? 'bg-espresso text-crema'
      : 'bg-danger-bg text-danger'

  return (
    <div className="divide-y divide-stone-100">
      {items.map((item, i) => (
        <div key={item.menuItemId} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${chipClass}`}>
              {i + 1}
            </span>
            <div>
              <span className="text-body-sm font-medium text-stone-900">{item.name}</span>
              {item.categoryName && (
                <span className="ml-1.5 text-caption text-stone-400">{item.categoryName}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="tabular-nums text-label-sm font-semibold text-stone-900">{formatCurrency(item.revenue)}</p>
            <p className="text-caption text-stone-400">{item.quantitySold} sold</p>
          </div>
        </div>
      ))}
    </div>
  )
}
