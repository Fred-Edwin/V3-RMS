'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { formatDayMonthYear } from '../../_shared/lib/people-dates';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { stillToFinish, type OwnForm } from '../lib/own-file';

/** The card of frame 8.1: a 48 px title row, then rows that each start with a hairline. */
export function OwnCard({ title, aside, children }: { title: string; /** Links at the right of the title row; they bring their own 44 px height. */ aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col border border-wds-border bg-wds-surface">
      <header className={cn('flex min-h-12 items-center justify-between pl-[18px]', aside ? 'pr-1.5' : 'pr-[18px]')}>
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** "Still to finish": a circle, the title and a grey line, and an amber underlined Add that is at least 44 px to tap. */
export function FinishCard({ file, open }: { file: EmployeeFile; open: (form: OwnForm) => void }) {
  const rows = stillToFinish(file);
  return (
    <OwnCard title="Still to finish">
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-14 items-center gap-3 border-t border-wds-border px-[18px]">
            <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-[#B5823E]" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{r.title}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.detail}</span>
            </span>
            <button
              type="button"
              aria-label={`${r.action} ${r.title}`}
              onClick={() => open(r.key)}
              className="-mr-1 flex min-h-11 min-w-11 items-center justify-center border-0 bg-transparent px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring"
            >
              {r.action}
            </button>
          </li>
        ))}
      </ul>
    </OwnCard>
  );
}

function JobRow({ label, tall = false, children }: { label: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center border-t border-wds-border px-[18px]', tall ? 'min-h-14' : 'min-h-12')}>
      <span className="w-[124px] shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{label}</span>
      {children}
    </div>
  );
}

const VALUE = 'font-wds-sans text-[14px] leading-[18px] text-wds-text-ink';

/** "Your job": Position, Site, Reports to (name over position and site), Started. Values start in one column, left aligned. */
export function JobCard({ file }: { file: EmployeeFile }) {
  const boss = file.reportsTo;
  return (
    <OwnCard title="Your job">
      <JobRow label="Position"><span className={VALUE}>{file.position?.name ?? 'Not set'}</span></JobRow>
      <JobRow label="Site"><span className={VALUE}>{file.organization.name}</span></JobRow>
      <JobRow label="Reports to" tall>
        {boss ? (
          <span className="flex min-w-0 flex-col gap-px">
            <span className={cn(VALUE, 'font-semibold')}>{boss.name}</span>
            {boss.positionName ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{[boss.positionName, boss.organizationName].join(' · ')}</span> : null}
          </span>
        ) : (
          <span className={cn(VALUE, 'text-wds-text-secondary')}>No head yet</span>
        )}
      </JobRow>
      <JobRow label="Started"><span className={VALUE}>{formatDayMonthYear(file.startDate)}</span></JobRow>
    </OwnCard>
  );
}
