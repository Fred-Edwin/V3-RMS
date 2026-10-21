'use client';

import { DialogButton, DrawerSection, ErrorBlock, KeyValueRows, ListSkeleton, WorkforceDrawer, initialsOf, useRemote } from '../../../_shared';
import { adjustLabel, statusLine, titleLine } from '../../_shared/lib/leave-copy';
import { momentLabel, rangeShort } from '../../_shared/lib/leave-dates';
import { leaveReads } from '../../_shared/services/leave-services';
import type { BalanceDrawer as DrawerData } from '../../_shared/types/leave-types';

function Body({ data, canAdjust, onAdjust }: { data: DrawerData; canAdjust: boolean; onAdjust: () => void }) {
  return (
    <>
      {!data.person.onPolicy ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{data.person.note ?? 'Not on the leave policy.'}</p> : null}
      {data.cards.map((c) => (
        <DrawerSection key={c.typeCode} caption={c.label.toUpperCase()}>
          <KeyValueRows
            aria-label={c.spoken}
            rows={[
              { label: 'Left now', value: String(c.left), mono: true },
              { label: 'Credited this year', value: String(c.credited), mono: true },
              { label: 'Taken', value: String(c.taken), mono: true },
              { label: 'Booked', value: String(c.booked), mono: true },
              ...(c.builds ? [{ label: 'Builds up', value: `${c.builds.perMonth} days a month` }] : []),
            ]}
          />
        </DrawerSection>
      ))}
      <DrawerSection caption={`REQUESTS IN ${data.year}`}>
        {data.requests.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No requests this year.</p> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.requests.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-wds-neutral-100 py-2 font-wds-sans text-[13px] leading-4">
                <span className="text-wds-text-ink">{`${titleLine(r)} · ${rangeShort(r.start, r.end)}`}</span>
                <span className="text-wds-text-secondary">{statusLine(r).text}</span>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>
      <DrawerSection caption="ADJUSTMENTS">
        {data.adjustments.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No adjustments this year.</p> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.adjustments.map((a) => (
              <li key={`${a.at}-${a.typeCode}`} className="flex items-baseline justify-between gap-3 border-b border-wds-neutral-100 py-2 font-wds-sans text-[13px] leading-4">
                <span className="text-wds-text-ink">{`${a.days > 0 ? '+' : ''}${a.days} d · ${a.typeCode.toLowerCase()} · ${adjustLabel(a.reasonCode) || 'Opening balance'}`}</span>
                <span className="text-wds-text-secondary">{`${momentLabel(a.at)}${a.by ? ` · ${a.by}` : ''}`}</span>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>
      {canAdjust && data.person.onPolicy ? <DialogButton kind="primary" size="lg" className="self-start" onClick={onAdjust}>Adjust this balance</DialogButton> : null}
    </>
  );
}

/** One person's leave in a right drawer (beyond Paper, spec Step 14): every type, the year's requests, the adjustment history. */
export function BalanceDrawer({ employeeId, onClose, canAdjust, onAdjust }: { employeeId: string | null; onClose: () => void; canAdjust: boolean; onAdjust: (person: { id: string; name: string; roleLabel: string }) => void }) {
  const remote = useRemote(() => leaveReads.drawer(employeeId ?? ''), `drawer:${employeeId}`, Boolean(employeeId));
  const data = remote.data && remote.data.person.id === employeeId ? remote.data : null;
  return (
    <WorkforceDrawer open={Boolean(employeeId)} onOpenChange={(o) => { if (!o) onClose(); }} title={data?.person.name ?? 'Leave'} subtitle={data ? `${data.person.roleLabel}${data.person.department ? ` · ${data.person.department}` : ''} · ${data.person.organization}` : undefined} initials={data ? initialsOf(data.person.name) : undefined}>
      {remote.status === 'error' && !data ? <ErrorBlock title="Their leave did not load" line="Nothing was changed. Try again." onRetry={remote.reload} /> : !data ? <ListSkeleton rows={5} columns={['fill']} label="Loading their leave" /> : <Body data={data} canAdjust={canAdjust} onAdjust={() => onAdjust({ id: data.person.id, name: data.person.name, roleLabel: data.person.roleLabel })} />}
    </WorkforceDrawer>
  );
}
