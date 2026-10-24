'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DOC_COLOURS, DocumentCanvas, ErrorBlock, ListSkeleton, SHIFT_PAINT, WorkforceDocument, useWorkforcePermissions } from '../../../_shared';
import { RefusalScreen } from '../../../refusal';
import { usePrintedRota } from '../../_shared/hooks/use-rota-data';
import { columnHead, printedDay, printedStamp, weekLongRange } from '../../_shared/lib/rota-dates';
import { hoursNumber, timeRangeWords, toneOfColour } from '../../_shared/lib/shift-look';
import type { PrintedRota } from '../../_shared/types/rota-types';

/** Landscape A4 is the page's own size when it is printed; the browser's margins go because the document draws its own. */
const PAGE_RULE = '@media print { @page { size: A4 landscape; margin: 0; } }';

export const rotaNumber = (weekStart: string): string => `ROT-${weekStart.slice(2).replace(/-/g, '')}`;

function RotaTable({ rota }: { rota: PrintedRota }) {
  const head = 'border-b px-1 py-1 text-center text-[13px] font-bold';
  return (
    <table className="mt-3 w-full border-collapse text-[13px]" style={{ borderTop: `2px solid ${DOC_COLOURS.ink}` }}>
      <thead>
        <tr>
          <th className={cn(head, 'w-[190px] text-left')} style={{ borderColor: DOC_COLOURS.ink }}>
            Name
          </th>
          {rota.days.map((d) => (
            <th key={d.date} className={head} style={{ borderColor: DOC_COLOURS.ink }}>
              {columnHead(d.date).replace(/^(\w{3}) (\d+)$/, (_, w: string, n: string) => `${w[0]}${w.slice(1).toLowerCase()} ${n}`)}
            </th>
          ))}
        </tr>
      </thead>
      {rota.departments.map((dept) => (
        <tbody key={dept.id ?? dept.name}>
          <tr>
            <td colSpan={8} className="pb-1 pt-3 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: DOC_COLOURS.navy }}>
              {dept.name}
            </td>
          </tr>
          {dept.people.map((p) => (
            <tr key={p.name} className="h-[22px]">
              <td className="whitespace-nowrap pr-2 text-[13px]">
                {p.name}
                {dept.headName === p.name ? ' (head)' : ''}
              </td>
              {rota.days.map((d) => {
                const shifts = p.days[d.date] ?? [];
                return (
                  <td key={d.date} className="px-1 text-center">
                    {shifts.length === 0 ? (
                      <span className="text-wds-neutral-500">{p.leaveDates.includes(d.date) ? 'Leave' : 'off'}</span>
                    ) : (
                      shifts.map((s, i) => (
                        <span key={i} className={cn('mx-auto mb-px block h-[18px] w-[100px] max-w-full border text-[13px] leading-[16px]', SHIFT_PAINT[toneOfColour(s.colour)].chip)}>
                          {s.name}
                        </span>
                      ))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

/**
 * The printed rota (Paper step 10): one landscape page for the notice board, grouped by department and colour-coded by shift. It carries
 * no pay. It is not a signed act, so the footer says who printed it and when, never "signed with PIN".
 */
export function PrintScreen({ weekStart, siteId, departmentId }: { weekStart: string; siteId?: string; departmentId?: string }) {
  const perms = useWorkforcePermissions();
  const rota = usePrintedRota(weekStart, siteId, departmentId, perms.ready && perms.can('rota.read'));
  if (!perms.ready && !perms.failed) return <ListSkeleton rows={6} label="Preparing the shifts" className="m-8" />;
  if (perms.failed) return <ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={perms.retry} className="m-8" />;
  if (!perms.can('rota.read')) return <RefusalScreen from="/app/workforce/schedule/rota/print" />;
  if (rota.status === 'error' && !rota.data) return <ErrorBlock title="We could not load this" line={rota.error.message} reference={rota.error.code} onRetry={rota.reload} className="m-8" />;
  const data = rota.data;
  if (!data) return <ListSkeleton rows={6} label="Preparing the shifts" className="m-8" />;
  const number = rotaNumber(data.weekStart);
  return (
    <DocumentCanvas onPrint={() => window.print()} printLabel="Print the shifts" width={1123}>
      <style>{PAGE_RULE}</style>
      <WorkforceDocument
        orientation="landscape"
        type="WEEKLY SHIFTS"
        number={number}
        date={printedDay(data.printedAt)}
        branchLine={`${data.organizationName} · Staff shifts ·${weekLongRange(data.weekStart)}`}
        signature={{ name: data.printedBy, roleLine: `Printed by ${data.printedBy}`, signedLine: `Printed ${printedStamp(data.printedAt)}` }}
        qr={{ value: typeof window === 'undefined' ? number : `${window.location.origin}/app/workforce/schedule/rota`, caption: `Scan to open ${number}` }}
        footerLeft={`Generated by Wendo RMS · ${number} · Page 1 of 1`}
      >
        {data.key.length > 0 ? (
          <ul aria-label="Shift colours" className="m-0 mt-4 flex list-none flex-wrap gap-x-6 gap-y-1.5 p-0 text-[13px]">
            {data.key.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span aria-hidden className={cn('h-[18px] w-[30px] border', SHIFT_PAINT[toneOfColour(t.colour)].chip)} />
                {t.name} {timeRangeWords(t)}
              </li>
            ))}
          </ul>
        ) : null}
        {data.departments.length === 0 ? <p className="mt-6 text-[15px]">No one has a shift this week.</p> : <RotaTable rota={data} />}
        <p className="m-0 mt-3 text-[12px] leading-4 text-wds-neutral-700">
          Planned hours are in Shift templates ({data.key.map((t) => `${t.name} ${hoursNumber(t.paidMinutes)} h`).join(', ') || 'none this week'}). Your own shifts are always on your phone.
        </p>
      </WorkforceDocument>
    </DocumentCanvas>
  );
}
