'use client';

const ALLOCATIONS = [
  { label: 'VAT (16%)',               pct: 0.16, colorClass: 'bg-red-400' },
  { label: 'Tourism Levy (2%)',        pct: 0.02, colorClass: 'bg-orange-400' },
  { label: 'Operational Costs (50%)', pct: 0.50, colorClass: 'bg-blue-400' },
  { label: 'Savings (20%)',            pct: 0.20, colorClass: 'bg-green-500' },
  { label: 'Miscellaneous (12%)',      pct: 0.12, colorClass: 'bg-stone-400' },
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
      <div className="mb-4">
        <h3 className="text-heading-md font-semibold text-stone-900">Revenue Allocation</h3>
        {period && <p className="mt-0.5 text-body-sm text-stone-500">{period}</p>}
        <p className="mt-1 text-display-sm font-bold text-espresso">{formatKes(totalRevenue)}</p>
        <p className="text-caption text-stone-500">Gross revenue</p>
      </div>

      <div className="space-y-3">
        {ALLOCATIONS.map(({ label, pct, colorClass }) => {
          const amount = totalRevenue * pct;
          const widthPct = Math.round(pct * 100);
          return (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-body-sm text-stone-700">{label}</span>
                <span className="tabular-nums text-label-sm font-semibold text-stone-900">
                  {formatKes(amount)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-2 rounded-full ${colorClass}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
