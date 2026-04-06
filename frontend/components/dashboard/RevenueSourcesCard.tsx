'use client';

const formatKes = (value: number): string =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface RevenueSourcesCardProps {
  foodRevenue: number;
  otherIncomeTotal: number;
  period?: string;
}

export function RevenueSourcesCard({
  foodRevenue,
  otherIncomeTotal,
  period,
}: RevenueSourcesCardProps): JSX.Element | null {
  if (otherIncomeTotal === 0) return null;

  const total = foodRevenue + otherIncomeTotal;
  const foodPct = total > 0 ? (foodRevenue / total) * 100 : 0;
  const otherPct = total > 0 ? (otherIncomeTotal / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-heading-md font-semibold text-stone-900">Revenue Sources</h3>
        {period && <span className="text-caption text-stone-400">{period}</span>}
      </div>

      {/* Two-segment bar */}
      <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full">
        <div
          className="bg-espresso"
          style={{ width: `${foodPct}%` }}
          title={`Food & Beverage: ${foodPct.toFixed(1)}%`}
        />
        <div
          className="bg-amber"
          style={{ width: `${otherPct}%` }}
          title={`Other Income: ${otherPct.toFixed(1)}%`}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-espresso" />
          <span className="flex-1 text-body-sm text-stone-700">
            Food &amp; Beverage
            <span className="ml-1 text-caption text-stone-400">({foodPct.toFixed(1)}%)</span>
          </span>
          <span className="tabular-nums text-label-sm font-semibold text-stone-900">
            {formatKes(foodRevenue)}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber" />
          <span className="flex-1 text-body-sm text-stone-700">
            Other Income
            <span className="ml-1 text-caption text-stone-400">({otherPct.toFixed(1)}%)</span>
          </span>
          <span className="tabular-nums text-label-sm font-semibold text-stone-900">
            {formatKes(otherIncomeTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
