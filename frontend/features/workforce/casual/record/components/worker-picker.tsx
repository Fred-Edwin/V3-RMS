'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover, PhoneButton } from '../../../_shared';
import { dayMonth } from '../../_shared/lib/casual-words';
import { readPeople, writePeople, type CachedWorker } from '../../_shared/lib/draft-store';
import { casualReads } from '../../_shared/services/casual-services';

/**
 * "My casuals": the department's workers to pick from. The list is kept on the phone, so picking works with no signal; a new casual
 * needs one. Someone already on today's sheet is shown and cannot be picked twice.
 */
export function WorkerPicker({ siteId, departmentId, taken, onPick, onNew }: { siteId: string; departmentId: string; taken: ReadonlySet<string>; onPick: (worker: CachedWorker) => void; onNew: () => void }) {
  const [people, setPeople] = React.useState<CachedWorker[]>(() => []);
  const [fresh, setFresh] = React.useState(false);

  React.useEffect(() => {
    setPeople(readPeople(siteId, departmentId));
    let cancelled = false;
    casualReads.people(siteId, departmentId).then(
      (rows) => {
        if (cancelled) return;
        setPeople(rows);
        setFresh(true);
        writePeople(siteId, departmentId, rows);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [siteId, departmentId]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">MY CASUALS</h3>
      {people.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{fresh ? 'No casuals yet for this department. Add the first one.' : 'Loading your casuals…'}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {people.map((p) => {
          const on = taken.has(p.id);
          return (
            <li key={p.id}>
              <button type="button" disabled={on} onClick={() => onPick(p)} className={cn('flex min-h-[56px] w-full flex-col items-start justify-center border border-wds-border bg-wds-surface px-3.5 py-2 text-left disabled:opacity-60', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
                <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{p.fullName}</span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{on ? 'Already on today’s sheet' : p.lastWorked ? `last worked ${dayMonth(p.lastWorked)}` : 'not worked yet'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <PhoneButton kind="outlined" size="sm" onClick={onNew}>
        New casual
      </PhoneButton>
    </div>
  );
}
