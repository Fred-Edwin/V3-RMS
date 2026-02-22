# Phase 1.5 — Design System & Component Library

## Context

Phase 1.5 delivers the complete reusable component library for Wendo RMS. No business features are built here — only the building blocks that every subsequent phase (2–6) will compose from. All screens from Phase 2 onwards must use these components exclusively; no ad-hoc per-screen styles.

**Codebase state confirmed:**
- Tailwind config already has all custom tokens (colors, fonts, shadows, radii, animations)
- `globals.css` already sets Crema background, Stone 900 text, DM Sans body font
- `layout.tsx` already loads Cormorant Garamond + DM Sans via `next/font/google`
- `lib/cn.ts` exists — clsx + tailwind-merge utility
- `lucide-react` installed, `zustand` installed
- `components/ui/` folder exists but is empty
- `/dev/components` route does not exist yet

---

## Implementation Order (dependency-safe)

```
Wave 1 — Zero-dependency atoms
Wave 2 — Foundation interactives (use Spinner)
Wave 3 — Form primitives (use Button, Spinner)
Wave 4 — Layout shells
Wave 5 — Navigation (use layout shells, Avatar, Badge)
Wave 6 — Card composites (use Badge, TimeElapsed, PriceDisplay, Avatar, Button)
Wave 7 — Overlay components (use Button, IconButton)
Wave 8 — Toast system (new Zustand store + hook)
Wave 9 — Feedback + Data display
Wave 10 — Barrel export + /dev/components catalogue
```

---

## Files to Create (44 new files + 1 modified)

### Wave 1 — `frontend/components/ui/`

**`Spinner.tsx`**
- Props: `{ size?: 'sm' | 'md' | 'lg'; className?: string }`
- Size map: sm=16px(`size-4`), md=24px(`size-6`), lg=40px(`size-10`)
- `rounded-full border-2 border-stone-200 border-t-espresso animate-spin`
- `role="status"` + sr-only text; `motion-reduce:animate-none`

**`Badge.tsx`**
- Props: `{ variant: 'pending'|'inprogress'|'ready'|'closed'|'cancelled'; size?: 'default'|'lg'; className?: string }`
- All color classes written as full strings (no string interpolation — Tailwind JIT requirement)
- variant map: `pending` → `bg-[#FDF3DC] text-[#92650A] border border-[#F0D080]`, etc.
- default: `text-label-sm px-2 py-0.5 rounded-full`; lg (KDS): `text-label-md px-3 py-1 rounded-full`
- Export `BadgeVariant` type

**`Divider.tsx`**
- Props: `{ label?: string; className?: string }`
- No label: `<hr className="border-stone-200" />`
- With label: two `<hr>` flanking a centered `<span className="text-label-sm text-stone-400 px-3">`

**`Avatar.tsx`**
- Props: `{ name: string; size?: 'sm'|'md'|'lg'; className?: string }`
- Size: sm=32px(`size-8`), md=40px(`size-10`), lg=48px(`size-12`)
- `bg-espresso text-crema rounded-full` with initials extracted from name
- `aria-label={name}`

**`PriceDisplay.tsx`**
- Props: `{ amount: number; className?: string }`
- Output: `KES 1,200.00` via `toLocaleString('en-KE', { minimumFractionDigits: 2 })`
- Always: `text-label-lg text-espresso font-semibold`

**`ConnectionIndicator.tsx`**
- Props: `{ status: 'connected'|'reconnecting'|'disconnected'; className?: string }`
- 10px dot: connected=`bg-green-500`, reconnecting=`bg-amber animate-pulse`, disconnected=`bg-red-500`
- `motion-reduce:animate-none`; `role="status"` + sr-only text

**`TimeElapsed.tsx`** — `'use client'`
- Props: `{ startTime: string | Date; className?: string }`
- `useState` + `setInterval` every 30s; cleanup on unmount
- Format: `< 1 min` / `{n} min` / `{h}h {m}m`
- `aria-live="polite"`

---

### Wave 2 — Foundation Interactives

**`Button.tsx`** — `React.forwardRef`
- Props: extends `ButtonHTMLAttributes`; adds `variant?`, `size?`, `isLoading?`, `leftIcon?`, `rightIcon?`
- Export `ButtonVariant`, `ButtonSize` types
- Sizes: lg=`h-12 px-7`, md=`h-11 px-6`, sm=`h-9 px-4`
- Variants (all use `rounded-md transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed`):
  - primary: `bg-espresso text-crema hover:bg-espresso-light active:scale-[0.98]`
  - secondary: `bg-transparent text-espresso border-[1.5px] border-espresso hover:bg-stone-100`
  - ghost: `bg-transparent text-stone-700 hover:bg-stone-100 active:bg-stone-200`
  - destructive: `bg-transparent text-[#991B1B] border-[1.5px] border-[#FCA5A5] hover:bg-[#FEF2F2]`
- Loading: replace children with `<Spinner size="sm" />`; maintain width; set `disabled` + `aria-busy="true"`

**`IconButton.tsx`** — `React.forwardRef`
- Props: `{ icon: ReactNode; label: string; variant?; size?; isLoading?; className? }` + `ButtonHTMLAttributes`
- `label` → `aria-label` only (not rendered visually)
- `rounded-full`; square dimensions: lg=`size-12`, md=`size-11`, sm=`size-9`
- Same variant classes as Button

---

### Wave 3 — Form Primitives

**`Input.tsx`**
- Props: extends `InputHTMLAttributes`; adds `label?`, `helperText?`, `errorMessage?`, `leftIcon?`, `rightIcon?`, `prefix?`, `inputClassName?`
- Height: `h-11`; base: `bg-parchment border-[1.5px] border-stone-200 rounded-sm text-body-md font-sans text-stone-900`
- Focus: `focus:border-espresso focus:outline-none focus:shadow-focus`
- Error: `border-[#FCA5A5]`; disabled: `bg-stone-100 opacity-50 cursor-not-allowed`
- Left icon: `absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none` + `pl-10` on input
- Prefix: flex container with `border-r border-stone-200` divider
- Error text: `role="alert"` in `text-[#991B1B]`

**`Textarea.tsx`**
- Same states as Input; `min-h-[88px]`; `resize-y` only (`style={{ resize: 'vertical' }}`); `px-3 py-2`

**`Select.tsx`**
- Props: `{ options: SelectOption[]; label?; placeholder?; helperText?; errorMessage?; hasError?; selectClassName? }` + `SelectHTMLAttributes`
- Native `<select>` with `appearance-none`; absolute `ChevronDown` icon right-side
- Same border/focus/error states as Input

**`Toggle.tsx`** — `'use client'`
- Props: `{ checked: boolean; onChange: (v: boolean) => void; label?; disabled?; className? }`
- `<button role="switch" aria-checked={checked}>`
- Track: `w-11 h-6 rounded-full transition-colors duration-[200ms]`; off=`bg-stone-300`, on=`bg-espresso`
- Thumb: `size-5 bg-white rounded-full shadow-sm transition-transform duration-[200ms]`; off=`translate-x-0.5`, on=`translate-x-5`
- `motion-reduce:transition-none`

**`FormField.tsx`**
- Props: `{ label: string; htmlFor: string; helperText?; errorMessage?; required?; className?; children: ReactNode }`
- Pure layout wrapper: `<label>` + `{children}` + helper/error below
- Required: `<span className="text-[#991B1B] ml-0.5">*</span>`

**`DatePicker.tsx`** — `'use client'`
- Props: `{ value: string; onChange: (v: string) => void; label?; min?; max?; disabled?; className? }`
- Mobile (`md:hidden`): native `<input type="date">`
- Desktop (`hidden md:block`): Input + CalendarIcon → Popover with hand-rolled calendar grid (native Date API)
- Selected day: `bg-espresso text-crema rounded-md`; today: `font-semibold text-amber`; other months: `text-stone-400`

**`TimePicker.tsx`** — `'use client'`
- Props: `{ value: string; onChange: (v: string) => void; label?; min?; max?; disabled?; className? }`
- Native `<input type="time">` with Clock icon left; same styling as Input

---

### Wave 4 — Layout Shells

**`PageLayout.tsx`** (Server Component)
- `px-4 md:px-6 lg:px-8 py-6 w-full`

**`PageHeader.tsx`** (Server Component)
- Props: `{ title: string; subtitle?; action?: ReactNode; className? }`
- Title: `text-heading-xl font-sans font-semibold text-stone-900`
- `flex items-start justify-between border-b border-stone-200 pb-4 mb-6`

**`MobileLayout.tsx`** — `'use client'`
- Props: `{ children: ReactNode; bottomNav?: ReactNode; className? }`
- Shell: `min-h-screen flex flex-col bg-crema`
- Main: `flex-1 overflow-y-auto` + inline style `paddingBottom: 'calc(64px + env(safe-area-inset-bottom))'`
- BottomNav slot: `fixed bottom-0 left-0 right-0 z-40`

**`SidebarLayout.tsx`** (Server Component)
- Props: `{ sidebar: ReactNode; children: ReactNode; className? }`
- `flex min-h-screen bg-crema`; sidebar: `w-60 shrink-0 bg-white border-r border-stone-200`

**`FullscreenLayout.tsx`** (Server Component)
- `min-h-screen w-full flex flex-col bg-stone-900 overflow-hidden` (dark for KDS/BDS)

---

### Wave 5 — Navigation

**`BottomNav.tsx`** — `'use client'`
- Props: `{ tabs: NavTab[]; activeHref: string; className? }` — export `NavTab` type
- Container: `h-16 bg-white border-t border-stone-200 flex` + inline style `paddingBottom: 'env(safe-area-inset-bottom)'`
- Active tab: `text-espresso`; amber 2px top indicator bar (absolute positioned)
- Inactive: `text-stone-400`; Next.js `<Link>` for each tab

**`SidebarNav.tsx`** — `'use client'`
- Props: `{ sections: NavSection[]; activeHref: string; logo?: ReactNode; className? }` — export `NavSection`, `NavItem` types
- Section label: `text-label-sm font-semibold text-stone-400 uppercase tracking-wider`
- Active item: `bg-stone-100 text-espresso border-l-2 border-espresso pl-[14px]`
- Inactive: `text-stone-600 hover:bg-stone-100 hover:text-stone-900`

**`TopBar.tsx`** — `'use client'`
- Props: `{ branchName: string; connectionStatus: 'connected'|'reconnecting'|'disconnected'; className? }`
- `h-14 bg-stone-900 text-crema grid grid-cols-3 items-center px-6`
- Live clock: `useEffect` + `setInterval` every 1s; format `HH:MM:SS`; cleanup on unmount

---

### Wave 6 — Card Composites

**`Card.tsx`**
- Named exports: `Card`, `CardHeader`, `CardBody`, `CardFooter`
- Base: `bg-white border border-stone-200 shadow-md rounded-md`
- Interactive (onClick provided): `cursor-pointer hover:shadow-lg transition-shadow duration-fast`

**`StatCard.tsx`**
- Props: `{ value: string|number; label: string; icon?: ReactNode; caption?; className? }`
- Value: `text-display-lg font-display font-medium text-stone-900` (Cormorant Garamond)
- Label: `text-label-sm font-sans font-semibold uppercase tracking-wider text-stone-500`
- Icon: `absolute top-4 right-4 text-stone-400`

**`OrderCard.tsx`** — `'use client'`
- Props: `{ orderNumber; status: OrderStatus; type: OrderType; tableNumber?; startTime; onTap?; className? }`
- `border-l-[3px]` colored by status; uses `<Badge>` + `<TimeElapsed>`
- Order number: `text-heading-sm font-semibold text-espresso`

**`KDSCard.tsx`** — `'use client'`
- Props: `{ orderNumber; type; tableNumber?; items: KDSItem[]; specialInstructions?; startTime; status; actionLabel; onAction; className? }`
- `border-l-[4px]` colored by ticket status (PENDING/IN_PROGRESS/READY)
- Timer color: 0–9min=`text-stone-500`, 10–19min=`text-[#C4862A]`, 20+min=`text-[#991B1B]`
- Action: full-width `<Button variant="primary" size="lg" className="w-full mt-3">`

**`MenuItemCard.tsx`** — `'use client'`
- Props: `{ name; description?; price; isAvailable; onAdd?; className? }`
- Unavailable: `opacity-45 pointer-events-none` on card
- Add button: `<IconButton>` positioned `absolute bottom-3 right-3`; uses `<PriceDisplay>`

**`StaffCard.tsx`**
- Props: `{ name; role; isActive; className? }`
- Uses `<Avatar>`; active dot `size-2 rounded-full bg-green-500` on avatar

---

### Wave 7 — Overlays

**`Modal.tsx`** — `'use client'`
- Props: `{ isOpen; onClose; title?; children; footer?; maxWidth?: 'sm'|'md'|'lg'; className? }`
- `ReactDOM.createPortal` to `document.body`
- Backdrop: `fixed inset-0 bg-[rgba(28,25,23,0.5)] z-50 flex items-center justify-center p-4`
- Panel: `bg-white rounded-lg shadow-xl w-full max-w-[560px]`; `animate-fade-up motion-reduce:animate-none`
- Escape key listener; backdrop click closes; body scroll lock; simple focus trap (first/last focusable refs)

**`BottomSheet.tsx`** — `'use client'`
- Props: `{ isOpen; onClose; title?; children; className? }`
- Portal; same backdrop as Modal
- `fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[90vh]`
- Drag handle: `w-8 h-1 bg-stone-300 rounded-full mx-auto mt-3`
- `animate-slide-up motion-reduce:animate-none`

**`Popover.tsx`** — `'use client'`
- Props: `{ trigger: ReactNode; children: ReactNode; placement?: 'top'|'bottom'|'left'|'right'; className? }`
- `useRef` + `getBoundingClientRect()` for positioning; close on outside click + Escape
- Panel: `absolute bg-white rounded-md shadow-lg border border-stone-200 z-30`

**`ConfirmDialog.tsx`**
- Props: `{ isOpen; onClose; onConfirm; title; description; confirmLabel?; cancelLabel?; isLoading?; className? }`
- Composes `<Modal maxWidth="sm">`
- Footer: `<Button variant="secondary">Cancel</Button>` + `<Button variant="destructive" isLoading>Confirm</Button>`

---

### Wave 8 — Toast System

**`frontend/store/toastStore.ts`**
- Zustand store; `addToast` (generates `crypto.randomUUID()`, caps at 3), `removeToast`

**`frontend/hooks/useToast.ts`**
- Wraps `addToast` from store
- Auto-dismiss: success/info=4000ms, warning=6000ms, error=never (manual close only)

**`Toast.tsx`** — `'use client'`
- Props: `{ id; variant; title; message?; onClose: (id: string) => void }`
- Left border + icon per variant (success=`#86EFAC`/CheckCircle2, error=`#FCA5A5`/XCircle, warning=`#FCD34D`/AlertTriangle, info=stone-300/Info)
- `animate-slide-in-top motion-reduce:animate-none`

**`ToastContainer.tsx`** — `'use client'`
- No external props; reads `toastStore` directly
- Portal to `document.body`
- Desktop: `fixed top-4 right-4 z-[60]`; mobile: centered top
- Max 3 stacked; maps toasts → `<Toast>`

---

### Wave 9 — Feedback + Data Display

**`EmptyState.tsx`**
- Props: `{ icon: ReactNode; heading: string; body?; action?: ReactNode; className? }`
- `flex flex-col items-center text-center py-12 px-4`
- Icon wrapper: `text-stone-300 mb-4`; heading: `text-heading-sm text-stone-700`; body: `text-body-sm text-stone-500 max-w-xs`

**`OfflineBanner.tsx`** — `'use client'`
- No props (listens to `navigator.onLine` via `online`/`offline` events)
- `fixed top-0 left-0 right-0 z-[70] bg-[#FFFBEB] text-[#92400E] border-b border-[#FCD34D] h-10`
- `WifiOff` icon + `"You're offline — check your connection"`
- `animate-slide-in-top`

**`SkeletonBlock.tsx`**
- Props: `{ width?; height?; radius?; className? }` (all Tailwind class strings)
- `bg-gradient-to-r from-stone-100 via-stone-200 to-stone-100 bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none`

**`SkeletonCard.tsx`**
- Composes `<SkeletonBlock>` inside a Card-like container

**`SkeletonTable.tsx`**
- Props: `{ rows?: number; columns?: number; className? }` (defaults: rows=5, cols=4)
- Header blocks: `w-20 h-3`; body rows: `w-full h-4`; each row height: `h-[52px]`

**`Table.tsx`** — `'use client'`
- Generic: `function Table<T extends Record<string, unknown>>(props: TableProps<T>)` (function declaration, not arrow, to avoid `<T>` JSX ambiguity)
- Export `TableColumn` type
- Header: `text-label-sm font-semibold uppercase tracking-wider text-stone-500 border-b-2 border-stone-200 h-11 px-4`
- Rows: `h-[52px] border-b border-stone-100 px-4 hover:bg-stone-100`
- No vertical borders
- Sortable: `ChevronsUpDown`/`ChevronUp`/`ChevronDown` lucide icons; sorted column header in `text-amber`
- Empty state: `<td colSpan={columns.length}>` with emptyState slot

---

### Wave 10 — Barrel + Catalogue

**`frontend/components/ui/index.ts`**
- Re-exports every component and type with named exports

**`frontend/app/dev/components/page.tsx`** — `'use client'`
- Long scrolling single page demonstrating every component in every meaningful state
- Page bg: `bg-crema p-8`; title: `text-display-lg font-display`
- Sections: Typography specimens, Color swatches, Spinner, Badge (all 5×2), Divider, Avatar, Button (all 4×3 + loading/disabled), IconButton, PriceDisplay/ConnectionIndicator/TimeElapsed, Input (all states), Textarea, Select, Toggle, FormField, DatePicker, TimePicker, Card, StatCard, OrderCard (all 5 status), KDSCard (normal + late), MenuItemCard (available + unavailable), StaffCard, Modal (open via button), BottomSheet, Popover, ConfirmDialog, Toast (4 buttons triggering toasts), EmptyState, OfflineBanner, Skeleton components, Table

---

### Modifications to Existing Files

**`frontend/app/layout.tsx`** (only existing file modified)
- Add `<ToastContainer />` and `<OfflineBanner />` inside `<body>` after the `{children}` slot
- Both are `'use client'` components that render globally via portals

**`frontend/middleware.ts`** — No change needed
- The `/dev` route is not in the current matcher pattern, so it is already unprotected

---

## Key Implementation Rules

1. **No `any` types** — TypeScript strict mode throughout
2. **All class names as complete strings** — never build Tailwind class names with string interpolation (JIT scanner will not pick them up)
3. **Use `cn()` from `@/lib/cn`** in every component for conditional class composition
4. **`motion-reduce:animate-none`** on every animated element
5. **`React.forwardRef`** on Button and IconButton
6. **Named exports only** — no default exports on components
7. **Safe-area insets** via inline `style` prop (CSS `env()` not expressible as static Tailwind class)
8. **Generic Table** — must use `function` declaration syntax not arrow function to avoid TSX `<T>` ambiguity
9. **All interactive components** (Modal, BottomSheet, Popover, Toggle, DatePicker, TimePicker, TopBar, TimeElapsed, OfflineBanner) require `'use client'`
10. **Portal components** (Modal, BottomSheet, ToastContainer) must `ReactDOM.createPortal` to `document.body`

---

## Verification

After implementation:
1. Run `pnpm dev` and navigate to `http://localhost:3000/dev/components`
2. Verify every component renders at 375px (mobile) and 1280px (desktop) viewport widths
3. Verify interactive states: hover, focus, active, disabled, loading, error
4. Verify all 5 Badge variants render with correct colors from the design system
5. Verify amber focus ring appears on Input, Select, Toggle, Button — not default browser blue
6. Verify Toast system: click all 4 variant buttons; success/info auto-dismiss at 4s; error requires manual close; max 3 stacked
7. Verify Modal + BottomSheet: open/close animations; Escape key closes; backdrop click closes; body scroll locked while open
8. Verify `prefers-reduced-motion`: enable in OS accessibility settings and confirm all animations are disabled
9. Verify KDSCard timer color: manually set `startTime` to 11 min ago (amber), 21 min ago (red)
10. Run `pnpm typecheck` — must pass with zero errors
 