'use client';

import { Callout, EmptyState, Panel } from '../../_shared';
import { dayMonthTime, hoursOf, kes, kesSigned, people } from '../_shared/lib/format';
import type { StoredEstimate } from '../_shared/types/tab-types';
import { EstimateBar, pct } from './estimate-bar';

const TH = 'px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary text-right';
const NUM = 'px-3.5 py-[11px] text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink';

/**
 * The running month as an estimate (spec S10): read only, gross only, never exported. It uses the pay profiles and the authorised
 * overtime to today, and assumes the rest of the month follows the rota. The nightly job writes it; before its first run the panel says so.
 */
export function EstimatePanel({ monthLabel, estimate, ready, computedAt }: { monthLabel: string; estimate: StoredEstimate | null; ready: boolean; computedAt: string | null }) {
  if (!ready || !estimate) {
    return <EmptyState kind="nothingYet" title="Not worked out yet" line="It appears after tonight's update." />;
  }
  const e = estimate;
  const earned = pct(Number(e.earnedSoFar), Number(e.expectedGross));
  const today = pct(e.dayOfMonth, e.daysInMonth);
  const off = e.sites.filter((s) => !s.onNewSystem);
  const bySite = new Map(e.bySite.map((s) => [s.siteId, s]));
  const rows = e.sites.filter((s) => s.onNewSystem);
  return (
    <div className="flex flex-col gap-4">
      <Panel title={`Pay earned so far in ${monthLabel}`} caption={computedAt ? `UPDATED ${dayMonthTime(computedAt).toUpperCase()} · REFRESHED EVERY NIGHT` : undefined}>
        <div className="flex flex-col gap-2.5">
          <EstimateBar earnedPercent={earned} todayPercent={today} label={`Earned ${Math.round(earned)} percent of expected; today is ${Math.round(today)} percent of the month`} />
          <div className="flex flex-wrap justify-between gap-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            <span>
              KES {kes(e.earnedSoFar)} earned, {Math.round(earned)}% of the expected {kes(e.expectedGross)}
            </span>
            <span>
              The marker is today: day {e.dayOfMonth} of {e.daysInMonth}, {Math.round(today)}% of the month
            </span>
          </div>
        </div>
      </Panel>
      <Panel title="Expected gross, by site" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">Expected gross by site, {monthLabel}</caption>
            <thead>
              <tr className="border-b border-wds-text-ink">
                <th scope="col" className={`${TH} text-left`}>SITE</th>
                <th scope="col" className={TH}>PEOPLE</th>
                <th scope="col" className={TH}>EARNED SO FAR</th>
                <th scope="col" className={TH}>EXPECTED</th>
                <th scope="col" className={TH}>VS LAST MONTH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const row = bySite.get(s.siteId);
                return (
                  <tr key={s.siteId} className="border-b border-wds-neutral-100">
                    <th scope="row" className="px-3.5 py-[11px] text-left font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{s.name}</th>
                    <td className={NUM}>{row?.people ?? 0}</td>
                    <td className={NUM}>{kes(row?.earned)}</td>
                    <td className={NUM}>{kes(row?.expected)}</td>
                    <td className={`${NUM} text-wds-text-secondary`}>{row?.vsLast ? kesSigned(row.vsLast) : '—'}</td>
                  </tr>
                );
              })}
              {off.map((s) => (
                <tr key={s.siteId} className="border-b border-wds-neutral-100">
                  <th scope="row" className="px-3.5 py-[11px] text-left font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-secondary">{s.name}</th>
                  <td colSpan={4} className="px-3.5 py-[11px] font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Not on the new system yet · —</td>
                </tr>
              ))}
              <tr className="bg-wds-neutral-50 font-semibold">
                <th scope="row" className="px-3.5 py-[11px] text-left font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Total</th>
                <td className={NUM}>{e.bySite.reduce((t, s) => t + s.people, 0)}</td>
                <td className={NUM}>{kes(e.earnedSoFar)}</td>
                <td className={NUM}>{kes(e.expectedGross)}</td>
                <td className={NUM}>{e.vsLastMonth ? kesSigned(e.vsLastMonth.amount) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {off.length > 0 ? <p className="m-0 border-t border-wds-neutral-100 px-3.5 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{rows.length} {rows.length === 1 ? 'site' : 'sites'}, {off.length} not on the new system.</p> : null}
      </Panel>
      <Callout tone="warning" title="An estimate, not the payroll">
        It uses the rota and the clock-ins to today and assumes the rest of the month follows the rota. Nothing is paid until the Branch Managers approve the timesheets.
        {e.toDecideOvertime.minutes > 0 ? ` Overtime still to decide (${hoursOf(e.toDecideOvertime.minutes)}) could add about KES ${kes(e.toDecideOvertime.value)}.` : ''}
        {e.missingProfiles > 0 ? ` ${people(e.missingProfiles)} ${e.missingProfiles === 1 ? 'has' : 'have'} no pay profile and ${e.missingProfiles === 1 ? 'is' : 'are'} not included.` : ''}
      </Callout>
    </div>
  );
}
