import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';

/**
 * Layout-mirroring loading skeletons — one per screen, replacing the generic
 * `LoadingState` card for the screens Paper draws a bespoke loading state
 * for. Reference: Paper page `3-0`, `5R3-0` ("A2 · Suppliers list · desktop ·
 * loading") and `71E-0` ("A3 · Supplier detail · desktop · loading") — real
 * breadcrumb/title/toolbar/actions stay put, only the data region (KPI
 * values, table rows, form fields) swaps to skeleton blocks. Mobile variants
 * and the Item Catalog skeleton have no Paper node (not drawn there) and
 * follow the same established pattern instead of a literal Paper source.
 *
 * All blocks are the shared animated `Skeleton` primitive — Paper's own
 * export is static (it doesn't draw micro-interactions), the sweep animation
 * is the existing code-side convention, not new here.
 */

/* ----------------------------------------------------- Suppliers · list */

/** The 3-cell KPI row from `5R3-0` (dash placeholder, matching Paper's
 * literal "—" for a value that hasn't loaded). Split out from the table
 * skeleton below since the live `SuppliersScreen` doesn't render this strip
 * yet (Milestone One's contract is profile-only — see the screen's own
 * comment) — kept here, unused for now, for whichever later milestone adds
 * the AP-aware KPI strip `5R3-0` actually shows. */
export function SuppliersKpiSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      {['Total invoiced (90d)', 'Paid', 'Outstanding'].map((label, i) => (
        <div key={label} className={cn('flex flex-1 flex-col gap-1.5 p-wds-4', i < 2 && 'border-r border-wds-border')}>
          <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{label.toUpperCase()}</span>
          <span className="font-wds-mono text-wds-kpi font-medium text-wds-text-faint">—</span>
        </div>
      ))}
    </div>
  );
}

/** Desktop table skeleton. Reference: `5R3-0`'s table region — 6 skeleton
 * rows matching the real table's column widths (`suppliers-screen.tsx`). */
export function SuppliersListSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-[30px] items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        {['Supplier', 'Invoiced', 'Paid', 'Outstanding', 'Current / overdue'].map((label) => (
          <span key={label} className="mr-6 font-wds-mono text-wds-label font-semibold text-wds-text-ink last:mr-0">
            {label.toUpperCase()}
          </span>
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <Skeleton className="h-3 w-[180px] shrink-0" />
          <Skeleton className="h-3 w-[120px] shrink-0" />
          <div className="grow" />
          <Skeleton className="h-3 w-[70px] shrink-0" />
          <Skeleton className="h-3 w-[96px] shrink-0" />
          <Skeleton className="h-3 w-[110px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile — not in Paper (only desktop drawn for A2). Follows the same
 * "real header/title stays, content becomes skeleton" rule, shaped to match
 * `SuppliersScreen`'s actual mobile card list (name + subtitle per row).
 */
export function SuppliersListSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-wds-border p-wds-3 last:border-b-0">
          <Skeleton className="h-3.5 w-[55%]" />
          <Skeleton className="h-3 w-[35%]" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------- Suppliers · detail */

/** Desktop. Reference: `71E-0` — title block, a summary strip, a form-section
 * card (label + strip + 2-up row), then a closing block. */
export function SupplierDetailSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-1 flex-col gap-5', className)}>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-[26px] w-[220px]" />
        <Skeleton className="h-3 w-[160px]" />
      </div>
      <Skeleton className="h-16 rounded-wds-md" />
      <div className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-4.5">
        <Skeleton className="h-3.5 w-[140px]" />
        <Skeleton className="h-16 rounded-wds-md" />
        <div className="flex grow gap-4">
          <Skeleton className="flex-1 rounded-wds-md" />
          <Skeleton className="flex-1 rounded-wds-md" />
        </div>
      </div>
      <Skeleton className="h-[200px] rounded-wds-md" />
    </div>
  );
}

/** Mobile — not in Paper. Same block shapes as desktop, stacked full-width
 * for a narrower viewport (no 2-up row — single column, matching how the
 * real Supplier form/detail collapses to one column on mobile). */
export function SupplierDetailSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Skeleton className="h-16 rounded-wds-md" />
      <div className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3">
        <Skeleton className="h-3.5 w-[120px]" />
        <Skeleton className="h-14 rounded-wds-md" />
        <Skeleton className="h-14 rounded-wds-md" />
      </div>
      <Skeleton className="h-[160px] rounded-wds-md" />
    </div>
  );
}

/* ------------------------------------------------------------- Catalog */

/**
 * Item Catalog — no Paper loading node exists for this screen at all.
 * Follows the same pattern established by Suppliers (`5R3-0`): real KPI
 * strip/toolbar shell stays, table rows become skeleton blocks matching
 * `ItemCatalogTable`'s actual column widths (`item-catalog-table.tsx`).
 */
export function ItemCatalogSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex h-[46px] items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <Skeleton className="h-3 min-w-[180px] flex-1" />
          <Skeleton className="h-3 w-[120px] shrink-0" />
          <Skeleton className="h-3 w-[140px] shrink-0" />
          <Skeleton className="h-3 w-[160px] shrink-0" />
          <Skeleton className="h-3 w-[110px] shrink-0" />
          <Skeleton className="h-3 w-[120px] shrink-0" />
          <Skeleton className="h-3 w-[250px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Mobile — matches `ItemCatalogList`'s real card shape (name + units row, caption below). */
export function ItemCatalogSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-wds-border p-wds-3 last:border-b-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-[50%]" />
            <Skeleton className="h-3 w-[15%]" />
          </div>
          <Skeleton className="h-3 w-[65%]" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------- Purchasing hub (M2) */

/**
 * Purchasing hub bespoke loading skeleton — Paper draws one (`WK4-0`),
 * unlike most Milestone Two screens (plan §3a). Real shell (breadcrumb,
 * title, "New purchase" button) stays; KPI strip values go to `—`
 * (`text-wds-text-faint`, matching Paper's literal dash placeholder), the
 * Inbound band's header row stays real with 4 skeleton rows beneath, and the
 * History band the same with its own 5-column skeleton row shape — sourced
 * from `get_jsx` on `WK4-0`, not guessed from the ready-state shape.
 */
export function PurchasingHubKpiSkeletonDesktop({ className }: { className?: string }) {
  const labels = ['EXPECTED', 'AWAITING INVOICE', 'OWED (AP)'];
  return (
    <div className={cn('flex rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      {labels.map((label, i) => (
        <div
          key={label}
          className={cn('flex grow basis-0 flex-col gap-wds-1.5 bg-wds-gradient-surface-raise p-wds-4', i < labels.length - 1 && 'border-r border-wds-border')}
        >
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">{label}</span>
          <span className="font-wds-mono text-wds-kpi font-medium text-wds-text-faint">—</span>
        </div>
      ))}
    </div>
  );
}

export function PurchasingHubInboundSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Inbound</span>
        <span className="ml-auto font-wds-mono text-wds-label text-wds-text-copy-muted">LOADING…</span>
      </div>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
        <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Detail</span>
        <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
        <span className="w-[160px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
        <span className="w-[130px] shrink-0" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <Skeleton className="h-3 w-[180px] shrink-0" />
          <Skeleton className="h-3 grow" />
          <Skeleton className="h-3 w-[70px] shrink-0" />
          <Skeleton className="h-3 w-[96px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function PurchasingHubHistorySkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">History</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">all purchases &amp; receipts</span>
      </div>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="w-[130px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Ref</span>
        <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
        <span className="w-[90px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Date</span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Value</span>
        <span className="w-[180px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex h-[44px] items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <Skeleton className="h-2.5 w-[90px] shrink-0" />
          <Skeleton className="h-2.5 w-[140px] shrink-0" />
          <div className="grow" />
          <Skeleton className="h-2.5 w-[70px] shrink-0" />
          <Skeleton className="h-2.5 w-[80px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Mobile — not in Paper. Reuses the shared `MobileLoadingState`'s KPI+card shape. */
export function PurchasingHubSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-wds-3.5', className)}>
      <div className="flex gap-wds-2.5">
        {['Expected', 'Awaiting invoice'].map((label) => (
          <div key={label} className="flex grow basis-0 flex-col gap-1 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3">
            <span className="font-wds-mono text-wds-kpi-label-sm uppercase text-wds-text-copy-muted">{label}</span>
            <span className="font-wds-mono text-wds-kpi-sm font-medium text-wds-text-faint">—</span>
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-border p-wds-3.5">
          <Skeleton className="h-3 w-[120px]" />
          <Skeleton className="h-[11px] w-[200px]" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------ Receiving worklist (M2) */

/** No bespoke Paper artboard (plan §3a) — screen-mirroring skeleton built to the default rule, matching `ReceivingWorklistScreen`'s real table shape. */
export function ReceivingWorklistSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Expected today</span>
      </div>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="w-[220px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
        <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Expected</span>
        <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
        <span className="w-[160px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
        <span className="w-[110px] shrink-0" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex h-[56px] items-center gap-4 border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <Skeleton className="h-3 w-[200px] shrink-0" />
          <Skeleton className="h-3 grow" />
          <Skeleton className="h-3 w-[70px] shrink-0" />
          <Skeleton className="h-3 w-[96px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Mobile — matches the real mobile card list (name + detail + Receive button). */
export function ReceivingWorklistSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className="flex flex-col gap-wds-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn('flex flex-col gap-wds-2 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3.5', className)}>
          <Skeleton className="h-3.5 w-[45%]" />
          <Skeleton className="h-3 w-[65%]" />
          <Skeleton className="mt-1 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
