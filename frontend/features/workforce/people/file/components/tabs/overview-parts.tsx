import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { CompletenessRing, LifeTimeline, Panel, ProbationBar, StatusTag, probationTextClass, useWorkforcePermissions } from '../../../../_shared';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import { lifeEvents } from '../../lib/file-timeline';
import { nextStepRows, probationCard, ringChips, ringSummary, type FileDialogKey } from '../../lib/file-model';

/** The blocks the Overview variants share (Paper `Y8C-0`). Each takes the file and draws; `open` is how a button asks for a dialog. */
export type OpenDialog = (dialog: FileDialogKey, requestId?: string) => void;

/** The ring, the six chips (a gap is a button that opens the fix), and the sentence under them. */
export function FileRingCard({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  const canWriteSensitive = useWorkforcePermissions().can('employee.write_sensitive');
  if (!file.completeness) return null;
  const summary = ringSummary(file);
  const fix = (part: string): FileDialogKey | null =>
    part === 'CONTRACT' && file.actions.createContract ? 'contract'
    : part === 'EMERGENCY_CONTACT' ? (file.actions.remind ? 'ask' : null)
    : part === 'BANK' && file.actions.editBank ? 'ids-bank'
    : part === 'PAY' && file.actions.changePay ? 'change-pay'
    : part === 'IDENTITY' && canWriteSensitive ? 'ids-bank'
    : null;
  return (
    <section aria-label="Completeness of the file" className="flex gap-[22px] border border-wds-border bg-wds-surface px-5 py-[18px] max-sm:flex-col">
      <CompletenessRing percent={file.completeness.ringPercent} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <div className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{summary.caption}</div>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {ringChips(file).map((c) => {
            const target = c.done ? null : fix(c.part);
            const tag = (
              <StatusTag tone={c.done ? 'success' : 'warning'} size="header" mark={c.done ? 'done' : 'open'}>
                {c.label}
              </StatusTag>
            );
            return <li key={c.part}>{target ? <button type="button" onClick={() => open(target)} className="cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:shadow-wds-ring">{tag}</button> : tag}</li>;
          })}
        </ul>
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{summary.note}</p>
      </div>
    </section>
  );
}

/** "Day 80 of 90 · 10 days left", the bar, and the three dates. */
export function ProbationPanel({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  const card = probationCard(file);
  if (!card) return null;
  return (
    <section aria-label="Probation" className="flex flex-col gap-3 border border-t-2 border-wds-border border-t-wds-primary bg-wds-surface px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">PROBATION</span>
        {file.actions.decideProbation ? (
          <button type="button" onClick={() => open('probation')} className="border-0 bg-transparent p-0 font-wds-sans text-[13px] leading-4 text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
            {card.decideBy} →
          </button>
        ) : null}
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`font-wds-sans text-[30px] font-semibold leading-[34px] tracking-[-0.025em] ${probationTextClass(card.daysLeft)}`}>Day {card.dayNumber}</span>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
          of {card.totalDays} · {card.daysLeft} {card.daysLeft === 1 ? 'day' : 'days'} left
        </span>
      </div>
      <ProbationBar dayNumber={card.dayNumber} totalDays={card.totalDays} />
      <div className="flex justify-between font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        <span>Started {formatDayMonth(card.startedOn)}</span>
        <span>{card.report}</span>
        <span>Ends {formatDayMonth(card.endsOn)}</span>
      </div>
    </section>
  );
}

/** "Next steps · 3 OPEN": a title and, when the viewer may act, one outlined button. */
export function NextStepsPanel({ file, open, title = 'Next steps' }: { file: EmployeeFile; open: OpenDialog; title?: string }) {
  const rows = nextStepRows(file);
  if (rows.length === 0) return null;
  return (
    <Panel title={title} caption={`${rows.length} OPEN`} padded={false}>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 border-t border-wds-border px-4 py-3">
            <span className="flex min-w-0 items-center gap-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
              <span aria-hidden className={`h-2 w-2 shrink-0 ${r.muted ? 'bg-wds-neutral-400' : 'bg-wds-caramel-600'}`} />
              {r.title}
            </span>
            {r.action ? (
              <Button type="button" variant="flat" size="sm" onClick={() => open(r.action!.dialog, r.action!.requestId)}>
                {r.action.label}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function LifeBand({ file }: { file: EmployeeFile }) {
  const events = lifeEvents(file);
  if (events.length === 0) return null;
  return (
    <section aria-label="Life at Wendo" className="flex min-w-0 flex-col gap-2.5 overflow-x-auto border border-wds-border bg-wds-surface px-5 py-3.5">
      <div className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">LIFE AT WENDO</div>
      <LifeTimeline events={events} />
    </section>
  );
}
