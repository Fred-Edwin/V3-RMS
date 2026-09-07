# Phase 1.5 â€” Context (Living File)

This file is updated as tasks are completed. It is the agent's source of truth about what has been done and what decisions were made during this phase.

---

## Status
- [ ] Phase 1.5 In Progress
- [x] Phase 1.5 Complete

---

## Completed Tasks

### Setup
- [x] Confirmed Tailwind config with all custom tokens already applied from Phase 0
- [x] Global CSS already set (Crema background, Stone 900 text, DM Sans body font) â€” no changes needed
- [x] Google Fonts loading confirmed (Cormorant Garamond + DM Sans) â€” no changes needed
- [x] `components/ui/` folder populated with complete component library
- [x] `/dev/components` route created at `frontend/app/dev/components/page.tsx`

### Components Built (44 files)

**Wave 1 â€” Atoms**
- [x] `Spinner.tsx` â€” sm/md/lg sizes, `role="status"`, motion-reduce
- [x] `Badge.tsx` â€” all 5 status variants Ã— 2 sizes (default + lg for KDS)
- [x] `Divider.tsx` â€” plain and with label
- [x] `Avatar.tsx` â€” initials fallback, sm/md/lg, espresso background
- [x] `PriceDisplay.tsx` â€” KES formatting with `en-KE` locale
- [x] `ConnectionIndicator.tsx` â€” connected/reconnecting/disconnected states
- [x] `TimeElapsed.tsx` â€” live 30s polling, `aria-live="polite"`

**Wave 2 â€” Foundation Interactives**
- [x] `Button.tsx` â€” 4 variants Ã— 3 sizes, loading state, forwardRef
- [x] `IconButton.tsx` â€” circular, same variants, forwardRef

**Wave 3 â€” Form Primitives**
- [x] `Input.tsx` â€” all states, left/right icon, prefix, label, helper/error
- [x] `Textarea.tsx` â€” vertical resize only, all states
- [x] `Select.tsx` â€” native select, custom chevron, all states
- [x] `Toggle.tsx` â€” role="switch", Espresso on, Stone 300 off
- [x] `FormField.tsx` â€” layout wrapper with required indicator
- [x] `DatePicker.tsx` â€” native on mobile, hand-rolled calendar on desktop
- [x] `TimePicker.tsx` â€” native time input with Clock icon

**Wave 4 â€” Layout Shells**
- [x] `PageLayout.tsx` â€” responsive padding 16/24/32px
- [x] `PageHeader.tsx` â€” title/subtitle/action slot, Stone 200 border-bottom
- [x] `MobileLayout.tsx` â€” safe-area-inset-bottom via inline style
- [x] `SidebarLayout.tsx` â€” 240px sidebar, sticky, full height
- [x] `FullscreenLayout.tsx` â€” Stone 900 background for KDS/BDS

**Wave 5 â€” Navigation**
- [x] `BottomNav.tsx` â€” amber top indicator, safe-area, Next.js Link
- [x] `SidebarNav.tsx` â€” sections with labels, active state with Espresso left border
- [x] `TopBar.tsx` â€” live clock (1s interval), ConnectionIndicator, dark background

**Wave 6 â€” Card Composites**
- [x] `Card.tsx` â€” Header/Body/Footer sub-components, interactive onClick support
- [x] `StatCard.tsx` â€” Cormorant Garamond display-lg value
- [x] `OrderCard.tsx` â€” 3px status left border, Badge + TimeElapsed
- [x] `KDSCard.tsx` â€” 4px ticket status border, timer colour progression, full-width action
- [x] `MenuItemCard.tsx` â€” unavailable state opacity, IconButton add
- [x] `StaffCard.tsx` â€” Avatar with active dot overlay

**Wave 7 â€” Overlays**
- [x] `Modal.tsx` â€” portal, focus trap, Escape, backdrop click, body scroll lock, animate-fade-up
- [x] `BottomSheet.tsx` â€” portal, drag handle, animate-slide-up, safe-area bottom
- [x] `Popover.tsx` â€” outside click close, Escape, 4 placement options
- [x] `ConfirmDialog.tsx` â€” composes Modal, Destructive + Secondary buttons

**Wave 8 â€” Toast System**
- [x] `store/toastStore.ts` â€” Zustand store, max 3 toasts, crypto.randomUUID
- [x] `hooks/useToast.ts` â€” auto-dismiss: success/info 4s, warning 6s, error never
- [x] `Toast.tsx` â€” 4 variants with semantic left border + icon
- [x] `ToastContainer.tsx` â€” portal, desktop top-right, mobile top-centre

**Wave 9 â€” Feedback + Data Display**
- [x] `EmptyState.tsx` â€” icon/heading/body/action slots
- [x] `OfflineBanner.tsx` â€” navigator.onLine listener, fixed z-[70]
- [x] `SkeletonBlock.tsx` â€” shimmer animation, flexible dimensions
- [x] `SkeletonCard.tsx` â€” pre-composed card skeleton
- [x] `SkeletonTable.tsx` â€” configurable rows/columns, 52px row height
- [x] `Table.tsx` â€” generic, sortable columns, empty state slot, no vertical borders

**Wave 10 â€” Barrel + Catalogue**
- [x] `components/ui/index.ts` â€” all named exports + types
- [x] `app/dev/components/page.tsx` â€” 30-section visual catalogue
- [x] `app/layout.tsx` â€” ToastContainer + OfflineBanner added globally

---

## Decisions Made

### Icon type in NavTab/NavItem
Lucide icon components have a `size` prop typed as `string | number`, which conflicts with our original `{ size?: number }` constraint. Changed `NavTab.icon` and `NavItem.icon` to `React.ElementType` â€” fully compatible with Lucide and any other icon library.

### Generic Table component
Used `function Table<T>()` declaration (not arrow function) to avoid TypeScript/TSX `<T>` ambiguity. `SampleRow` in the dev catalogue uses `extends Record<string, unknown>` to satisfy the constraint.

### Safe-area insets
`env(safe-area-inset-bottom)` cannot be expressed as a static Tailwind class. Applied via inline `style` prop in `MobileLayout.tsx` and `BottomNav.tsx` â€” the only intentional use of inline styles in the codebase.

### Status colour classes
All status/semantic hex values written as complete Tailwind arbitrary class strings (e.g., `bg-[#FDF3DC]`) in static `const` maps â€” never constructed via string interpolation. This ensures Tailwind's JIT scanner includes them in the bundle.

### DatePicker
Built without a third-party library using the native Date API. Desktop gets a custom calendar popover; mobile gets a native `<input type="date">` for the best touch UX. No `react-datepicker` or `react-day-picker` dependency added.


### ToastContainer - SSR guard
Added `typeof document === 'undefined'` guard before `createPortal` to prevent errors during server-side rendering.

### Resolved issue - Primary button text invisible on dark backgrounds
Observed on `Button` primary variant in `/dev/components`: text rendered near-black on `bg-espresso` instead of `text-crema`.

Root cause:
- `cn()` uses `tailwind-merge` (`frontend/lib/cn.ts`).
- Custom typography tokens (`text-label-lg`, `text-label-md`, etc.) were not registered in merge config.
- `tailwind-merge` treated these `text-*` tokens as conflicting text color utilities and removed `text-crema` when both were present.
- Result: color fell back to global `body` text color (`#1c1917`), causing low contrast on espresso backgrounds.

Fix implemented:
- Updated `frontend/lib/cn.ts` to use `extendTailwindMerge(...)`.
- Added custom text scale tokens to `extend.theme.text`:
  `display-*`, `heading-*`, `body-*`, `label-*`, and `caption`.
- This makes merge behavior keep both text size and text color classes, so `text-crema` is preserved alongside `text-label-*`.

Validation:
- Reproduced merge behavior via Node check before/after fix.
- `pnpm typecheck` passes after the change.

---

## Blockers / Issues

- Resolved: Primary button text appeared invisible on dark background due to a `tailwind-merge` class conflict (see decision above).
- Current status: no active blockers.

---

## Notes for Next Phase (Phase 2 - Menu Management)

- Import all components from `@/components/ui` (barrel export) â€” never from deep paths
- `Table` component is generic: pass the row type as `<Table<YourRowType> ...>`
- Use `useToast()` from `@/hooks/useToast` for all feedback toasts
- `ConfirmDialog` is ready for all destructive actions (delete category, delete item)
- `Modal` + `BottomSheet` handle all create/edit forms â€” Modal on desktop, BottomSheet on mobile
- `StatCard` values use `font-display` (Cormorant Garamond) automatically â€” no extra class needed
- `Badge` covers all order statuses â€” pass `variant` as lowercase (`pending`, `inprogress`, `ready`, etc.)
- All form inputs (`Input`, `Select`, `Textarea`) share the same Parchment background + Stone 200 border + amber focus ring
- `/dev/components` route is live and accessible without authentication â€” useful for design review



