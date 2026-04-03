'use client';

const ALLOCATIONS = [
  { label: 'VAT (16%)',               pct: 0.16, dotClass: 'bg-red-400',           barClass: 'bg-red-400' },
  { label: 'Tourism Levy (2%)',        pct: 0.02, dotClass: 'bg-amber',             barClass: 'bg-amber' },
  { label: 'Operational Costs (50%)', pct: 0.50, dotClass: 'bg-espresso',          barClass: 'bg-espresso' },
  { label: 'Savings (20%)',            pct: 0.20, dotClass: 'bg-status-ready-text', barClass: 'bg-status-ready-text' },
  { label: 'Miscellaneous (12%)',      pct: 0.12, dotClass: 'bg-stone-400',         barClass: 'bg-stone-400' },
] as const;

const formatKes = (value: number): string =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface RevenueBreakdownCardProps {
  totalRevenue: number;
  period?: string;
}

export function RevenueBreakdownCard({ totalRevenue, period }: RevenueBreakdownCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-heading-md font-semibold text-stone-900">Revenue Allocation</h3>
          {period && <span className="text-caption text-stone-400">{period}</span>}
        </div>
        <p className="mt-1 font-display text-display-lg font-semibold leading-tight text-espresso">
          {formatKes(totalRevenue)}
        </p>
        <p className="text-caption uppercase tracking-widest text-stone-400">Gross revenue</p>
      </div>

      {/* Stacked bar — no rounding, segments flush together */}
      <div className="mb-5 flex h-3 w-full overflow-hidden">
        {ALLOCATIONS.map(({ label, pct, barClass }) => (
          <div
            key={label}
            className={barClass}
            style={{ width: `${pct * 100}%` }}
            title={`${label}: ${Math.round(pct * 100)}%`}
          />
        ))}
      </div>

      {/* Dot + label + amount rows */}
      <div className="space-y-2.5">
        {ALLOCATIONS.map(({ label, pct, dotClass }) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
            <span className="flex-1 text-body-sm text-stone-700">{label}</span>
            <span className="tabular-nums text-label-sm font-semibold text-stone-900">
              {formatKes(totalRevenue * pct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
