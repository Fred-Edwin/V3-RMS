import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import { CompletenessRing, KeyValueRows } from '../../../../_shared';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { jobLeaveRows } from '../../lib/file-rows';
import { onboardingRows, onboardingSentence } from '../../lib/onboarding-rows';
import type { OpenDialog } from './overview-parts';

/** A person who has not started or is still being set up (Paper `SBM-0`): the checklist with the ring, and "Job and leave" beside it. */
export function OnboardingOverview({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  const rows = onboardingRows(file);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-8 max-lg:grid-cols-1">
      <section aria-label="Onboarding checklist" className="border border-wds-border bg-wds-surface">
        <div className="flex items-center gap-5 px-6 py-5">
          <CompletenessRing percent={file.completeness?.checklistPercent ?? 0} />
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">Onboarding checklist</h2>
            <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{onboardingSentence(file)}</p>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.key} className={cn('flex items-center gap-3 border-t border-wds-border px-5 py-3', r.waiting && 'bg-wds-warning-bg/50')}>
              <span
                aria-hidden
                className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] leading-none', r.done ? 'border-wds-success-fg bg-wds-success-fg text-wds-primary-fg' : 'border-wds-neutral-400 text-transparent')}
              >
                ✓
              </span>
              <span className="min-w-0 grow font-wds-sans text-[15px] leading-5 text-wds-text-ink">
                <span className="sr-only">{r.done ? 'Done: ' : 'Not done yet: '}</span>
                {r.title}
              </span>
              <span className={cn('shrink-0 text-right font-wds-sans text-[13px] leading-4', r.waiting ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{r.status}</span>
              {r.action ? (
                <Button type="button" variant="flat" size="sm" onClick={() => open(r.action!.dialog, r.action!.requestId)}>
                  {r.action.label}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <aside className="flex flex-col gap-4">
        <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-[22px] text-wds-text-ink">Job and leave</h2>
        <KeyValueRows rows={jobLeaveRows(file)} aria-label="Job and leave" />
        {file.locked.includes('pay') ? null : <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Pay figures are on the Job and pay tab, visible to HR, the Director and the Accountant only.</p>}
      </aside>
    </div>
  );
}
