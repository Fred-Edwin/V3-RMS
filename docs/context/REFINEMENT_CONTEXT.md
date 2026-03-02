# UI/UX Refinement Context

## Overview
This document tracks all design and UI/UX refinements applied after the core feature phases were complete. The goal is a premium, warm, editorial aesthetic consistent with the Wendo Coffee Bistro brand.

**Design Philosophy:** Restraint is a premium signal. Cormorant Garamond for personality (display/titles), Jost for clarity (all operational UI). Warmth over sterility. Space is clarity.

---

## Typography System

### Font Swap: DM Sans → Jost
**Files:** `frontend/app/layout.tsx`, `frontend/tailwind.config.ts`, `docs/DESIGN_SYSTEM.md`

- Replaced `DM_Sans` with `Jost` (variable font, weights 300–700) via `next/font/google`
- Jost is a geometric sans modeled on the Johnston/Futura tradition — same modernist era as Cormorant Garamond's Renaissance revival. Reads as editorial and artisanal rather than startup SaaS.
- CSS variable `--font-sans` unchanged — swap was global with zero page-by-page changes required
- Tailwind `sans` fallback chain updated: `['Jost', 'Futura', 'Century Gothic', 'sans-serif']`
- Tailwind `display` fallback chain updated: `['Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', 'serif']`

### Typography Hierarchy Rules (enforced)
- `font-display text-display-lg font-semibold` — page-level hero titles (Cormorant, 36px)
- `font-display text-display-lg font-semibold` — section hero titles (e.g. "Daily Summary")
- `text-heading-md font-semibold` — section panel headings (DM Sans → Jost, 20px)
- `text-heading-sm font-semibold` — card headings (18px)
- `text-body-sm` — body / descriptive text
- `text-label-sm uppercase tracking-wider` — card labels / metadata
- `text-caption` — tertiary info (dates, counts)

### PageHeader Enhancement
**File:** `frontend/components/ui/PageHeader.tsx`

Added optional `titleClassName` prop so individual pages can use `font-display` without changing the default. Default remains `font-sans font-semibold text-heading-xl`.

---

## Component Refinements

### StatCard
**File:** `frontend/components/ui/StatCard.tsx`

Complete layout and sizing overhaul:
- **Layout:** Changed from single left-aligned column to a 2-row flex structure:
  - Top row: `label` (left) + `icon` (right) — paired as a card header
  - Bottom row: `value` (left, baseline) + `caption` (right, baseline-aligned) — value and its qualifier read as a unit
- **Value size:** `text-display-lg font-display` (36px Cormorant) → `text-heading-lg font-sans font-semibold` (24px Jost) — operational numbers are not hero moments
- **Padding:** `p-6` → `p-4 sm:p-5` — tighter on mobile where cards are narrow
- **Icon:** Removed `absolute` positioning; now `shrink-0` in the header row, color `text-stone-300`
- **Label:** `font-semibold text-stone-500` → `font-medium text-stone-400` — steps back, lets value breathe
- **Caption:** `mt-2 text-stone-500` → `mt-0 text-stone-400 shrink-0` — sits at baseline of value row

### BottomNav
**File:** `frontend/components/ui/BottomNav.tsx`

- Active tab: amber `h-0.5` top indicator line + `bg-espresso/10` pill behind icon
- Inactive: `text-stone-400`; Active: `text-espresso`

### OrderCard
**File:** `frontend/components/ui/OrderCard.tsx`

- Removed `border border-stone-200` (shadow-only treatment, no border)
- `rounded-md` → `rounded-xl`
- Order number: `text-heading-md font-bold`

### SidebarLayout
**File:** `frontend/components/ui/SidebarLayout.tsx`

- Added `hidden lg:flex` — sidebar shell is hidden on mobile (below `lg` breakpoint), enabling dual-shell responsive layout for manager roles

---

## Layout Architecture

### Dual-Shell Responsive Layout (Manager / Director / System Admin)
**File:** `frontend/app/app/layout.tsx`

Roles with sidebar on desktop + bottom nav on mobile use a CSS-only dual-shell approach:
- Both `SidebarLayout` and `MobileLayout` render simultaneously in the DOM
- `SidebarLayout` has `hidden lg:flex` — visible only on desktop
- `MobileLayout` has `lg:hidden` — visible only on mobile
- No JS resize listeners, no hydration mismatch, no layout flash

Mobile nav configs added for:
- `MANAGER`: 4 primary tabs (Dashboard, Orders, Staff, Reports) + 4 overflow (Menu, Shifts, Delivery Zones, Profile)
- `DIRECTOR`: 2 tabs (Dashboard, Profile)
- `SYSTEM_ADMIN`: 3 tabs (Branches, Menu, Profile)

---

## Page Refinements

### Login Page
**File:** `frontend/app/(auth)/login/page.tsx`

- `bg-crema` full-viewport background
- Circular logo with amber ring: `ring-2 ring-[#C4862A66] ring-offset-crema shadow-md`
- Brand title in `font-display text-display-xl text-espresso` with intentional `<br />` and `text-center`
- Design system `Input` + `Button` components replace bare HTML
- Password show/hide Eye/EyeOff toggle
- `animate-fade-up` entrance animation

### Profile Page
**File:** `frontend/app/app/profile/page.tsx`

- Identity Hero: centered avatar (`flex-col items-center`) above name — not horizontal layout
- Account Info: email on full-width row above 2-col grid (role/branch/org) to prevent text overflow
- Sign Out panel: `bg-[#FEF2F2] border-[#FCA5A5]` danger zone with centered icon and full-width button
- Split status messages: `profileStatus` / `passwordStatus` per card section

### Active Orders Page
**File:** `frontend/app/app/orders/page.tsx`

- Status filters: borderless scrollable pill row; active = `bg-espresso text-crema`, inactive = `bg-stone-100`
- Type filter moved to `BottomSheet` triggered by `SlidersHorizontal` icon button in header (no FAB)
- Active type filter shown as dismissible chip
- Warm empty state with ☕ emoji
- Pulse skeleton loaders

### Shifts Page
**File:** `frontend/app/app/shifts/page.tsx`

- Horizontal-scroll attendance table killed; replaced with vertical `divide-y divide-stone-100` list
- Each row: date + shift name (left), clock-in–out range + method (right)
- Empty states: warm Wendo-voice copy ("You're all clear", "Enjoy your rest")
- Section headings float directly above content

### ClockWidget
**File:** `frontend/components/shifts/ClockWidget.tsx`

- "No shift today" empty state replaced with warm copy: "You're off today / Enjoy your rest — no shift scheduled."
- Active widget: "Today's shift" label, `rounded-xl p-5`, em-dash in time range

### Manager Dashboard
**File:** `frontend/app/app/manage/dashboard/page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso` (Cormorant)
- **Top 3 StatCards:** `grid-cols-1 sm:grid-cols-3` — stacked vertically on mobile, 3-col on sm+
- **StatCard labels:** shortened to single metric name (`"Orders"`, `"Revenue"`, `"Avg Prep"`)
- **StatCard captions:** `"Today"` when today selected; formatted date (`"Thu, 27 Feb 2026"`) when past date selected — raw ISO dates eliminated everywhere
- **`(Selected Date)` suffix:** replaced with `formatDisplayDate()` output
- **Daily Summary heading:** `font-display text-display-lg font-semibold text-espresso`
- **Date picker:** bare `Input label="Date"` replaced with `CalendarDays` icon chip showing formatted date; invisible overlaid `<input type="date">` triggers native picker on tap
- **Staff roster rows:** `border border-stone-200 rounded-md` per row → `divide-y divide-stone-100` hairline separators, `first:pt-0 last:pb-0`
- **Active Orders empty state:** `BarChart2` icon → `ClipboardList` (semantic match)
- **Top 5 Selling Items:** removed double-border (outer container `bg-stone-50 border rounded-lg` removed); `divide-y divide-stone-100` rows with espresso rank badge circles
- **Section headings:** `heading-sm` → `heading-md` for Active Orders Feed and Staff On Shift panels
- **`Input` import removed** — no longer used (date picker is native)

### Staff Page
**File:** `frontend/app/app/manage/staff/page.tsx`

Full redesign from prototype to premium:
- **Page title:** `font-display text-display-lg font-semibold text-espresso`
- **Staff list:** single card with `divide-y divide-stone-100` rows (no per-row border cards)
- **Avatar:** letter avatar `h-9 w-9 rounded-full bg-stone-100` with initial
- **Role display:** human-readable (`"Kitchen Display"` not `"KITCHEN_DISPLAY"`) via `roleLabel` map, shown as pill chip (hidden on mobile, visible `sm:`)
- **Status badge:** semantic pill — `bg-[#EDFAF1] text-[#1A6B3C]` for active, `bg-stone-100 text-stone-500` for inactive
- **Actions:** icon-only buttons (`Pencil`, `UserX`/`UserCheck`) with semantic hover colours (red for deactivate, green for reactivate)
- **Loading state:** pulse skeleton rows matching list layout
- **Empty state:** `EmptyState` component with `UserCircle` icon
- **Error/success banners:** design system semantic colours
- **Form:** `sm:grid-cols-2` layout; all inputs have `label` prop; role options human-readable; `isLoading` spinner on submit button
- **Separate loading state card removed** — count shown live in section header subtitle

### Manager Reports Page
**File:** `frontend/app/app/manage/reports/page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso` (Cormorant)
- **Filter section:** changed from `md:grid-cols-4` (all-or-nothing) → `grid-cols-2 sm:grid-cols-2 md:grid-cols-4` so dates/selects sit in a 2-col grid on mobile; "Run Report" button spans `col-span-2 md:col-span-1`
- **Section headings:** `heading-sm` → `heading-md` for "Operational Trends" and "Staff Performance"
- **Chart titles:** shortened ("Total Orders Trend" → "Total Orders", etc.) for tighter mobile headers
- **Staff Performance section:** `items-center` → `items-start` in header flex to prevent vertical stretch issues

### LineTrendChart / MultiLineTrendChart (Mobile Optimization — Final)
**File:** `frontend/components/dashboard/PremiumChart.tsx`

- **ResizeObserver-based responsive SVGs:** replaced all `minWidth` + `overflow-x-auto` + `viewBox` approaches with a `useContainerWidth` hook that measures the actual container pixel width on mount and on every resize. SVG renders at exactly `width={containerWidth}` with no `viewBox` — pixel-exact to container at all breakpoints.
  ```tsx
  function useContainerWidth(fallback = 320): [React.RefObject<HTMLDivElement>, number] {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) setWidth(Math.floor(entry.contentRect.width));
      });
      observer.observe(el);
      setWidth(Math.floor(el.getBoundingClientRect().width));
      return () => observer.disconnect();
    }, []);
    return [ref, width];
  }
  ```
- **SVG wrapper:** `<div ref={containerRef} className="mt-4">` — no `overflow-x-auto`, no `minWidth` style
- **Chart height:** unified to `180px` for both `LineTrendChart` and `MultiLineTrendChart`
- **paddingX:** `44` → `52` — more room for y-axis labels on narrow mobile containers
- **paddingY:** `20` → `16`
- **Revenue formatter:** `toFixed(2)` → abbreviated `KES Xk` format (`value >= 1000 ? \`${(value/1000).toFixed(0)}k\` : value.toFixed(0)`) to prevent y-axis label overflow

### Manager Menu Page
**File:** `frontend/app/app/manage/menu/page.tsx`

- **Item grid:** `grid-cols-1 md:grid-cols-2` → `grid-cols-2` — 2-col on mobile matching waiter menu; `xl:grid-cols-3` retained
- **Card padding:** `p-3` → `p-2.5 sm:p-3` — slightly tighter on mobile
- **Card border-radius:** `rounded-md` → `rounded-xl`
- **Filter bar:** `grid-cols-1 lg:grid-cols-[...]` → `grid-cols-2 sm:grid-cols-[...]` — 2-col on mobile; search wraps to full width via `col-span-2 sm:col-span-1`
- **Station filter options:** uppercase `KITCHEN`/`BARISTA` → title-case `Kitchen`/`Barista`
- **Clear button:** "Clear Filters" → "Clear" for mobile width

### Shifts Page
**File:** `frontend/app/app/manage/shifts/page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso`
- **Section spacing:** `space-y-8` → `space-y-6`
- **Section cards:** `rounded-lg p-4` → `rounded-xl p-4 sm:p-5`
- **Section headings:** `heading-sm` → `heading-md`
- **Weekly grid:** `border-b border-stone-100` per row replaced with `divide-y divide-stone-100` on tbody; column headers use `divide-b-2 border-stone-100` and lighter `text-stone-400`
- **Today column:** highlighted with `bg-crema/30` background; header text uses `text-espresso font-semibold`
- **Assignment cell:** `rounded-md border bg-stone-100` → `rounded-lg border bg-white shadow-sm`; time range uses en-dash `–`
- **Remove link:** slightly muted `text-[#991B1B]/70` with hover to full red
- **Past cell:** `"Past"` text → `"—"` em-dash, `text-stone-300`
- **+ Assign button:** replaced `<Button variant="ghost">` with a plain `<button>` styled as caption link — lighter footprint in empty cells
- **Override action select:** `CLOCK_IN`/`CLOCK_OUT` → `"Clock In"`/`"Clock Out"` (human-readable)

### Director Dashboard
**File:** `frontend/app/app/director/page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso` via `titleClassName` prop
- **Overview Panel stat cards:** `grid-cols-2` → `grid-cols-1` — Total Revenue and Total Orders stack vertically
- **Overview filters:** `grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2` — 2-col on all sizes, full-width on mobile
- **Zero-orders banner:** `rounded-xl border border-amber/30 bg-amber/8` with `Globe` icon
- **Branch Performance filters:** `grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[1fr_1fr_auto_auto]` — stacks to 2-col on mobile
- **Staff Performance filters:** `grid grid-cols-2 gap-2 md:grid-cols-4`
- **Trend Analytics:** 6 charts in 3 rows of `lg:grid-cols-2` pairs:
  - Row 1: Total Revenue (KES Xk format) + Total Orders
  - Row 2: Revenue by Branch (KES Xk) + Orders by Branch
  - Row 3: Branch Contribution Share (X.X%) + Top Item Family Trends (KES Xk)
- **Section headings:** `text-heading-md font-semibold`, subtitle `mt-0.5 text-body-sm text-stone-500`
- **Section cards:** `rounded-xl p-4 sm:p-5`

### Performance Page
**File:** `frontend/app/app/performance/page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso`
- **Filter card:** `grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5`
- **Stat grids:** `grid grid-cols-2 gap-3 xl:grid-cols-4`
- **Top 5 Items:** `divide-y divide-stone-100` rows with espresso-background rank badge circles (`bg-espresso text-crema text-[10px] font-bold`)
- **Role-not-matching fallback:** `rounded-xl p-4 sm:p-5` wrapping `EmptyState`

### Delivery Zones Page
**File:** `frontend/app/app/manage/delivery-zones\page.tsx`

- **Page title:** `font-display text-display-lg font-semibold text-espresso`
- **Section card:** `rounded-lg` → `rounded-xl`, added `sm:p-5`
- **Empty state body:** warmer copy — "Add your first zone to enable delivery orders for this branch."
- **Toggle in edit modal:** wrapped in `rounded-lg bg-stone-50 px-4 py-3` container; label is contextual — "Zone is active — accepting delivery orders" / "Zone is inactive — hidden from orders"

### Waiter Dashboard (Mobile-First Polish)
**File:** `frontend/app/app/dashboard/page.tsx`

- Header action changed from top-right `New Order` button to profile avatar link (`/app/profile`) to remove nav redundancy with bottom tabs
- Greeting humanized: first-name extraction with username cleanup fallback (`waiter1.kingz` -> `Kingz`)
- Time-aware greeting (`Good morning/afternoon/evening, <name>`)
- Waiter stat cards switched to operational numeric styling: `font-sans`, `font-bold`, `tabular-nums`, tighter tracking
- Card density refined on mobile: stat card padding `p-4`

### Chef/Barista Dashboard Parity
**File:** `frontend/app/app/dashboard/page.tsx`

- Applied same premium header treatment as waiter: humanized greeting + avatar profile action
- Applied same metric readability treatment:
  - `Tickets Completed Today` and `Avg Prep Time Today` values in bold sans numeric style
  - `p-4` stat cards for tighter mobile rhythm

### New Order / Edit Order Category Chips
**Files:** `frontend/app/app/orders/new/page.tsx`, `frontend/app/app/orders/[id]/edit/page.tsx`

- Long category names no longer collapse or overflow awkwardly
- Added `shrink-0 whitespace-nowrap` to category buttons so chips keep shape and scroll cleanly in horizontal rail

### Menu Item Card Fallback (No Image)
**File:** `frontend/components/ui/MenuItemCard.tsx`

- Kept original card structure with fixed image area height
- Replaced broken-image icon style with premium fallback:
  - soft tan panel (`#EDE2D0`)
  - subtle radial wash
  - minimalist cup watermark icon
- Quantity/status/"Added" chips stay in the image area for consistent composition

### Mobile Bottom Navigation Overflow
**Files:** `frontend/components/ui/BottomNav.tsx`, `frontend/app/app/layout.tsx`

- Added overflow support with `More` entry (3-dot icon) that opens a `BottomSheet`
- Added role-aware overflow tab sets for `WAITER`, `CHEF`, `BARISTA`
- `Performance` and other secondary routes remain reachable on narrow phone widths
- Active-state indicator also applies when the current route is inside `More`

### History Page Mobile Readability
**Files:** `frontend/components/orders/OrderHistoryRow.tsx`, `frontend/app/app/history/page.tsx`

- Waiter history rows:
  - mobile (`< md`): stacked card-style row (order/date + badge + type/items + total)
  - desktop/tablet (`md+`): existing 6-column row retained
- Chef/Barista prep history:
  - mobile (`< md`): stacked row (order/date + status badge + items + prep time)
  - desktop/tablet (`md+`): existing 5-column grid retained
- Prep status now uses semantic `Badge` variants (`pending` / `inprogress` / `ready`)

### Shift Geofence Feedback
**File:** `frontend/components/shifts/ClockWidget.tsx`

- Geofence warning toast now consistently shows parsed distance from backend message
- Supports distance parsing in:
  - metres/meters
  - km
  - decimal/comma number formats
- User-facing copy now explicit:
  - Title: "Move closer to the branch"
  - Message: "You are approximately X m/km away. Move within 50 m to clock in/out."

### Toast ID Compatibility Fix
**File:** `frontend/store/toastStore.ts`

- Fixed runtime crash on environments where `crypto.randomUUID()` is unavailable (common on local HTTP mobile testing)
- Added safe ID fallback chain:
  - `crypto.randomUUID()`
  - `crypto.getRandomValues(...)`
  - timestamp + random string

### Backend Startup Stability (Redis/BullMQ)
**File:** `backend/src/server.ts`

- Prevented eager BullMQ import on every server startup
- Workers now lazy-load only when `START_BULLMQ_WORKERS=true`
- Eliminates unnecessary Redis TLS connection attempts in local/dev runs when workers are disabled

---

## Bug Fixes

### Manager Orders Tab — Middleware Block
**File:** `frontend/middleware.ts`

The `/app` catch-all path guard only permitted `WAITER | CHEF | BARISTA`. Navigating to `/app/orders` as MANAGER triggered a redirect to `/app/manage/dashboard`. Fixed by adding a specific rule before the catch-all:

```ts
if (pathname.startsWith('/app/orders')) {
  return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER';
}
```

---

## Design Tokens Reference (active)

```
font-display  → Cormorant Garamond (hero moments, page/section titles only)
font-sans     → Jost (all operational UI — buttons, labels, body, nav)

text-espresso → #2C1810  (primary actions, active nav, display titles)
bg-crema      → #F5F0E8  (page background — never pure white)
text-stone-400 → #A8A29E (labels, icons, metadata — tertiary hierarchy)
text-stone-500 → #78716C (subtitles, captions, muted body)
text-stone-900 → #1C1917 (primary text — near-black, warm undertone)
```
