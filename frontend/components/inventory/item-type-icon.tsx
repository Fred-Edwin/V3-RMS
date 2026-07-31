import {
  Beef,
  Coffee,
  Cookie,
  CupSoda,
  Droplet,
  Flame,
  Milk,
  Package,
  Salad,
  Snowflake,
  SprayCan,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react'
import type { InventoryItemType } from '@/types/inventory'

/**
 * Fallback icon per item type — used only when no name-pattern match applies.
 * A real custom icon set (coffee bag, milk carton, etc.) is still to be designed.
 */
export const itemTypeIcon: Record<InventoryItemType, React.ElementType> = {
  RAW: Package,
  PREPPED: UtensilsCrossed,
  PASS_THROUGH: Coffee,
}

export const itemTypeLabel: Record<InventoryItemType, string> = {
  RAW: 'Raw Ingredient',
  PREPPED: 'Prepped',
  PASS_THROUGH: 'Pass-Through',
}

// Ordered name-keyword -> icon lookup, checked before the type-level fallback
// above. Still a placeholder (no per-item icon field exists on InventoryItem
// yet) but gives visibly distinct icons for common Central Store items
// instead of one glyph per type bucket. Keep patterns narrow and ordered
// most-specific-first so e.g. "chicken stock" doesn't fall through to a
// meat icon just because "chicken" appears in it.
const NAME_ICON_RULES: { pattern: RegExp; icon: React.ElementType }[] = [
  { pattern: /coffee|espresso|arabica|robusta/i, icon: Coffee },
  { pattern: /milk|cream|yogurt|dairy/i, icon: Milk },
  { pattern: /chicken|beef|pork|bacon|sausage|meat/i, icon: Beef },
  { pattern: /flour|sugar|rice|wheat|grain/i, icon: Wheat },
  { pattern: /vegetable|lettuce|tomato|onion|fruit|salad/i, icon: Salad },
  { pattern: /syrup|sauce|honey|oil/i, icon: Droplet },
  { pattern: /water|juice|soda|bottled/i, icon: CupSoda },
  { pattern: /pastry|cookie|bread|dough|cake/i, icon: Cookie },
  { pattern: /gas|propane|charcoal/i, icon: Flame },
  { pattern: /frozen|ice/i, icon: Snowflake },
  { pattern: /clean|detergent|sanitizer|soap|chemical/i, icon: SprayCan },
]

/** Resolve the best-match icon for an item, falling back to its type icon. */
export function resolveItemIcon(name: string, type: InventoryItemType): React.ElementType {
  const rule = NAME_ICON_RULES.find((r) => r.pattern.test(name))
  return rule ? rule.icon : itemTypeIcon[type]
}
