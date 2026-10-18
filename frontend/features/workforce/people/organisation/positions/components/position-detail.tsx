'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { EmptyState, ErrorBlock, ListSkeleton, Panel, SettingRows } from '../../../../_shared';
import { usePosition } from '../../_shared/hooks/use-org-data';
import { holderLine, positionSubtitle, roleLabel } from '../lib/position-copy';

/** One position (Paper Chapter 3 step 06, right side): its settings, and the people who hold it that the viewer may see. */
export function PositionDetailPane({ id, canWrite, siteName, onEdit, onRetire, reloadKey }: { id: string; canWrite: boolean; siteName: (id: string) => string; onEdit: () => void; onRetire: () => void; reloadKey: number }) {
  const remote = usePosition(`${id}`);
  const reload = remote?.reload;
  React.useEffect(() => {
    if (reloadKey > 0) reload?.();
    // Reloads only when the screen says something changed (`reloadKey`); `reload` is stable.
  }, [reloadKey, reload]);

  if (!remote || remote.status === 'loading') return <div className="p-6"><ListSkeleton rows={4} label="Loading the position" /></div>;
  if (remote.status === 'error' && !remote.data) return <div className="p-6"><ErrorBlock title="The position did not load" line="Check your connection and try again." onRetry={remote.reload} /></div>;
  const p = remote.data;
  if (!p) return null;
  const yes = (on: boolean) => <span className={on ? 'text-wds-success-fg' : 'text-wds-text-secondary'}>{on ? 'Yes' : 'No'}</span>;
  return (
    <div className="flex flex-col gap-3.5 pb-6 pl-7 pt-3.5 max-md:pl-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 font-wds-sans text-[20px] font-semibold leading-6 tracking-[-0.02em] text-wds-text-ink">{p.name}{p.isActive ? '' : ' (retired)'}</h2>
          <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{positionSubtitle(p)}</p>
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button variant="flat" size="sm" onClick={onEdit}>Edit</Button>
            <Button variant="flat" size="sm" onClick={onRetire}>{p.isActive ? 'Retire' : 'Bring back'}</Button>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <Panel title="Settings">
          <SettingRows
            rows={[
              { title: 'Clocks in and out', value: yes(p.defaultTracksTime) },
              { title: 'Login role', value: p.loginRole ? roleLabel(p.loginRole) : 'No login needed' },
              { title: 'Casuals allowed', value: yes(p.casualsAllowed) },
            ]}
          />
        </Panel>
        <Panel title="People who hold it" count={p.holderCount > p.holders.length ? `${p.holders.length} of ${p.holderCount}` : undefined}>
          {p.holders.length === 0 ? (
            <EmptyState kind="nothingYet" title={p.holderCount === 0 ? 'Nobody holds it' : 'Nobody you can see'} line={p.holderCount === 0 ? 'It can be retired.' : 'The people who hold it work where you do not look after.'} />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {p.holders.map((h) => (
                <li key={h.employeeId} className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-2.5 last:border-b-0">
                  <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{h.name}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{holderLine(h, p, siteName, new Set())}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Retiring a position never deletes it. Old payslips and the audit log keep their meaning.</p>
    </div>
  );
}
