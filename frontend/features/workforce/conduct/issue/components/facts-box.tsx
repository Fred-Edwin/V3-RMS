import { ChoiceChips, Callout } from '../../../_shared';
import { monthYear } from '../../_shared/lib/conduct-dates';
import { plural } from '../../_shared/lib/conduct-words';
import type { Draft } from '../../_shared/types/conduct-types';

/**
 * "Attached from the timesheets" (Paper 1GLY-0): the tan box with the count and minutes for the month, so the manager does not retype
 * dates. While the facts load it says so; with none to attach it says what to do instead; the last three months can be chosen.
 */
export function FactsBox({ draft, loading, failed, month, onMonth, kind }: { draft: Draft | null; loading: boolean; failed: boolean; month: string | undefined; onMonth: (month: string) => void; kind: 'LATENESS' | 'ABSENCE' }) {
  const noun = kind === 'LATENESS' ? 'late arrival' : 'absence';
  if (failed) return <Callout tone="error" role="alert">The timesheets did not load. Nothing was sent. Choose the person again, or try later.</Callout>;
  if (loading || !draft) return <Callout tone="neutral" role="status">Checking the timesheets…</Callout>;
  const chosen = month ?? draft.month;
  return (
    <div className="flex flex-col gap-2.5">
      <Callout tone="warning" kicker="ATTACHED FROM THE TIMESHEETS">
        {draft.noFacts || !draft.facts ? (
          <span className="block font-semibold">No unexcused {kind === 'LATENESS' ? 'lateness' : 'absence'} in {monthYear(chosen)}. Choose another month or add your own line.</span>
        ) : (
          <>
            <span className="block text-[15px] font-semibold leading-5">
              {plural(draft.facts.count, noun)} in {monthYear(draft.facts.monthKey)}
              {kind === 'LATENESS' ? `, ${draft.facts.minutes} minutes in total` : ''}
            </span>
            <span className="mt-0.5 block">None were excused. The notice shows the dates, so you do not retype them.</span>
          </>
        )}
      </Callout>
      {draft.months.length > 1 ? (
        <ChoiceChips legend="Month" legendStyle="caps" size="sm" options={draft.months.map((m) => ({ value: m, label: monthYear(m) }))} value={chosen} onChange={onMonth} />
      ) : null}
    </div>
  );
}
