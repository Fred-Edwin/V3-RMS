import { Amount, HiddenNote } from '../../_shared/components/amount';
import { yearBar, yearRange } from '../../_shared/lib/pay-words';
import type { HomeData } from '../../_shared/types/payslip-types';

/**
 * "This year so far": earned, taken off, net. The bar is green for what you keep and amber (never the deep brown) for what was taken
 * off. While amounts are hidden no figure is in the markup; the bar shows only proportions and carries a text alternative.
 */
export function YearCard({ ytd, shown }: { ytd: NonNullable<HomeData['ytd']>; shown: boolean }) {
  const bar = yearBar(ytd.earned, ytd.takenOff);
  const cells: { label: string; value: string; tone: string }[] = [
    { label: 'Earned', value: ytd.earned, tone: 'text-wds-text-ink' },
    { label: 'Taken off', value: ytd.takenOff, tone: 'text-wds-caramel-600' },
    { label: 'Net paid to you', value: ytd.net, tone: 'text-wds-success-fg' },
  ];
  return (
    <section aria-label="Earned, taken off and net paid so far this year" className="flex flex-col gap-3 border border-wds-border bg-wds-surface p-3.5">
      <h2 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">THIS YEAR SO FAR · {yearRange(ytd.fromMonth, ytd.toMonth)}</h2>
      <div aria-hidden className="flex h-2.5 w-full gap-0.5">
        <span className="bg-wds-success-fg" style={{ width: `${bar.net}%` }} />
        {bar.off > 0 ? <span className="bg-wds-caramel-500" style={{ width: `${bar.off}%` }} /> : null}
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c.label}</dt>
            <dd className="m-0">
              <Amount value={c.value} shown={shown} dots={5} className={`text-[14px] font-semibold leading-[18px] ${c.tone}`} />
            </dd>
          </div>
        ))}
      </dl>
      <HiddenNote shown={shown} />
    </section>
  );
}
