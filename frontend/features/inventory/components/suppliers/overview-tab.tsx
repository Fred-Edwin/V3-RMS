import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import type { SupplierApDetail } from '../../types/receiving';
import type { SupplierDetail, SupplierSummary } from '../../types/supplier';
import { PROFILE_TOTAL, formatAmount, formatDayMonth, lateSentence, profileChecklist, type ProfileKey } from '../../lib/supplier-logic';
import { SUPPLIER_CONTACT_ROLE_LABEL } from '../../lib/supplier-labels';

const monoLabel = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary';

function Field({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 grow basis-0 flex-col gap-1">
      <span className={monoLabel}>{label.toUpperCase()}</span>
      <span className={cn('break-words text-[13px] leading-4 text-wds-text-ink', mono ? 'font-wds-mono' : 'font-wds-sans')}>{children}</span>
    </div>
  );
}

const dash = <span className="text-wds-text-muted">—</span>;

/** The checklist card: "Profile · 4 of 7", the bar, and the seven points with "Add" on the ones still open. */
export function ProfileCard({ supplier, canEdit, onAdd }: { supplier: SupplierDetail; canEdit: boolean; onAdd: (key: ProfileKey) => void }) {
  const { rows, done } = profileChecklist(supplier);
  const first = supplier.name.split(/\s+/)[0] ?? supplier.name;
  const left = rows.slice(0, 4);
  const right = rows.slice(4);
  const column = (items: typeof rows) => (
    <div className="flex grow basis-0 flex-col border-t border-wds-text-ink">
      {items.map((row) => (
        <div key={row.key} className="flex h-10 shrink-0 items-center gap-2.5 border-b border-wds-neutral-100">
          <span
            aria-hidden
            className={cn('size-3.5 shrink-0 rounded-[7px]', row.done ? 'bg-wds-success-fg' : 'border-[1.5px] border-wds-border-strong')}
          />
          <span className="grow font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            {row.label}
            <span className="sr-only">{row.done ? ', done' : ', still to add'}</span>
          </span>
          {!row.done && canEdit ? (
            <button
              type="button"
              onClick={() => onAdd(row.key)}
              className="rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:shadow-wds-ring"
            >
              Add<span className="sr-only"> {row.label.toLowerCase()}</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
  return (
    <section aria-label="Profile" className="flex flex-col gap-3.5 border border-wds-border bg-white px-5 py-[18px]">
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
          Profile · {done} of {PROFILE_TOTAL}
        </h2>
        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
          {done === PROFILE_TOTAL ? 'Everything is filled in.' : `You can already buy from ${first}. Finishing these makes payments and audits easier.`}
        </p>
      </div>
      <div className="flex h-1.5 shrink-0 bg-wds-neutral-100" role="progressbar" aria-valuemin={0} aria-valuemax={PROFILE_TOTAL} aria-valuenow={done} aria-label="Profile progress">
        <div className="bg-wds-selected-edge transition-[width] duration-300 ease-out" style={{ width: `${Math.round((done / PROFILE_TOTAL) * 100)}%` }} />
      </div>
      <div className="flex gap-3">
        {column(left)}
        {column(right)}
      </div>
    </section>
  );
}

function StripCell({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex grow basis-0 flex-col gap-1.5 px-4 py-3.5', !last && 'border-r border-wds-border')}>
      <span className={monoLabel}>{label}</span>
      <span className="font-wds-sans text-[20px] font-medium leading-6">{children}</span>
    </div>
  );
}

/** Spend · 90 days, last purchase, receipts, average days to pay, price alerts, short deliveries (Paper step 17). */
export function OverviewStrip({ summary, spend90Days }: { summary: SupplierSummary | null; spend90Days: string | null }) {
  const ink = 'text-wds-text-ink';
  const faint = <span className="text-wds-text-faint">—</span>;
  return (
    <div className="flex border border-wds-border bg-white">
      <StripCell label="SPEND · 90 DAYS">
        <span className={ink}>{spend90Days !== null ? `KES ${formatAmount(spend90Days)}` : faint}</span>
      </StripCell>
      <StripCell label="LAST PURCHASE">
        <span className={ink}>{summary ? (summary.lastPurchaseAt ? formatDayMonth(summary.lastPurchaseAt) : faint) : faint}</span>
      </StripCell>
      <StripCell label="RECEIPTS">
        <span className={ink}>{summary ? summary.receiptsCount : faint}</span>
      </StripCell>
      <StripCell label="AVG DAYS TO PAY">
        <span className={ink}>{summary && summary.averageDaysToPay !== null ? Math.round(summary.averageDaysToPay) : faint}</span>
      </StripCell>
      <StripCell label="PRICE ALERTS">
        <span className={summary && summary.priceAlerts > 0 ? 'text-wds-warning-fg' : ink}>{summary ? summary.priceAlerts : faint}</span>
      </StripCell>
      <StripCell label="SHORT DELIVERIES" last>
        <span className={ink}>{summary ? summary.shortDeliveries : faint}</span>
      </StripCell>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 grow basis-0 flex-col border border-wds-border bg-white">
      <h2 className="border-b border-wds-border px-[18px] py-3 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{title}</h2>
      <div className="flex flex-col gap-3.5 px-[18px] py-4">{children}</div>
    </section>
  );
}

export function DetailsCards({ supplier }: { supplier: SupplierDetail }) {
  const primary = supplier.primaryContact;
  return (
    <div className="flex gap-[18px]">
      <Card title="Supplier details">
        <div className="flex gap-6">
          <Field label="Trading name">{supplier.tradingName ?? dash}</Field>
          <Field label="KRA PIN" mono>
            {supplier.kraPin ?? dash}
          </Field>
        </div>
        <div className="flex gap-6">
          <Field label="Category">{supplier.category?.name ?? dash}</Field>
          <Field label="Credit limit" mono>
            {supplier.creditLimit ? `KES ${formatAmount(supplier.creditLimit)}` : dash}
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          <span className={monoLabel}>NOTES</span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{supplier.notes ?? dash}</span>
        </div>
      </Card>
      <Card title="Reach them">
        <div className="flex flex-col gap-1">
          <span className={monoLabel}>{`PRIMARY CONTACT${primary ? ` · ${SUPPLIER_CONTACT_ROLE_LABEL[primary.role].toUpperCase()}` : ''}`}</span>
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{primary?.name ?? dash}</span>
        </div>
        <div className="flex gap-6">
          <Field label="Phone" mono>
            {primary?.phone ?? dash}
          </Field>
          <Field label="Email">{primary?.email ?? dash}</Field>
        </div>
        <div className="flex flex-col gap-1">
          <span className={monoLabel}>ADDRESS</span>
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{supplier.address === '—' ? dash : supplier.address}</span>
        </div>
      </Card>
    </div>
  );
}

/**
 * What we owe (Paper step 17). Where Paper has "Open statement" and "Orders" (Purchasing screens not built yet),
 * the owner chose Record invoice and Record payment so the money jobs of the old Supplier AP keep working.
 */
export function OwedCard({
  owed,
  ap,
  canRecordInvoice,
  canRecordPayment,
  onRecordInvoice,
  onRecordPayment,
}: {
  owed: string | null;
  ap: SupplierApDetail | null;
  canRecordInvoice: boolean;
  canRecordPayment: boolean;
  onRecordInvoice: () => void;
  onRecordPayment: () => void;
}) {
  return (
    <section aria-label="What we owe" className="flex items-center justify-between gap-6 border border-wds-border bg-white px-5 py-4">
      <div className="flex min-w-0 items-center gap-6">
        <div className="flex shrink-0 flex-col gap-1">
          <span className={monoLabel}>WHAT WE OWE · MANAGER, ACCOUNTANT, DIRECTORS</span>
          <span className="font-wds-sans text-[20px] font-medium leading-6 text-wds-text-ink">{owed !== null ? `KES ${formatAmount(owed)}` : <span className="text-wds-text-faint">—</span>}</span>
        </div>
        <p className="max-w-[400px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{ap ? lateSentence(ap.row.buckets) : ''}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {canRecordInvoice ? (
          <Button variant="secondary" className="px-3.5" onClick={onRecordInvoice}>
            Record invoice
          </Button>
        ) : null}
        {canRecordPayment ? (
          <Button variant="secondary" className="px-3.5" onClick={onRecordPayment}>
            Record payment
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** No lines yet: the dashed call to add what the supplier sells. */
export function NothingBoughtCard({ supplierName, canEdit, onAdd }: { supplierName: string; canEdit: boolean; onAdd: () => void }) {
  const first = supplierName.split(/\s+/)[0] ?? supplierName;
  return (
    <div className="flex items-center justify-between gap-6 border border-dashed border-wds-border-strong bg-white px-5 py-[18px]">
      <div className="flex flex-col gap-1">
        <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">Nothing bought yet</span>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Add what {first} sells and at what price.</span>
      </div>
      {canEdit ? <Button className="h-[34px] px-4" onClick={onAdd}>Add what they sell</Button> : null}
    </div>
  );
}
