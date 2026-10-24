'use client';

import Link from 'next/link';
import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';

import { DayStrip, EmptyState, FOCUS_RING, MOTION, PickShiftButton, ShiftChip } from '../../../_shared';
import { PendingDialogs } from '../../dialogs/pending-dialogs';
import { useRotaSelection } from '../../grid/hooks/use-rota-selection';
import { dayOfMonth, longDay, weekdayName, weekPhoneRange } from '../../_shared/lib/rota-dates';
import { NO_ONE_ON_ROTA } from '../../_shared/lib/rota-copy';
import { cellNameOf, templateFits, toneOfColour } from '../../_shared/lib/shift-look';
import { ALL_DEPARTMENTS, listedDepartments, peopleIn } from '../../_shared/lib/week-view';
import type { WeekView } from '../../_shared/types/rota-types';
import { PhoneShiftSheet } from './phone-shift-sheet';

type Selection = ReturnType<typeof useRotaSelection>;

/**
 * The Rota on a phone (Paper step 9): a day at a time. Pick a day, tap a person, tap a shift, and it saves as you go. A department head
 * sees their own team; anyone else with a rota can switch department. Past days are read-only.
 */
export function RotaPhone({ selection: s, data }: { selection: Selection; data: WeekView }) {
  const departments = listedDepartments(data);
  const deptId = s.departmentId === ALL_DEPARTMENTS && departments.length === 1 ? (departments[0]?.id ?? ALL_DEPARTMENTS) : s.departmentId;
  const people = peopleIn(data, deptId);
  const departmentName = deptId === ALL_DEPARTMENTS ? 'Everyone' : (data.departments.find((d) => d.id === deptId)?.name ?? '');
  const [date, setDate] = React.useState(() => (data.days.some((d) => d.date === data.today) ? data.today : (data.days[0]?.date ?? data.weekStart)));
  const [chosenId, setChosenId] = React.useState<string | null>(null);
  const day = data.days.find((d) => d.date === date) ?? data.days[0];
  const canWrite = data.can.write && !day?.isPast;
  const chosen = people.find((p) => p.employeeId === chosenId) ?? null;
  const templates = React.useMemo(() => new Map(data.templates.map((t) => [t.id, t] as const)), [data.templates]);
  const working = people.filter((p) => (p.cells[date] ?? []).length > 0).length;
  const needs = deptId === ALL_DEPARTMENTS ? null : (day?.byDepartment[deptId]?.needs ?? null);
  const thin = needs !== null && working < needs;

  const pick = (templateId: string | null): void => {
    if (chosen) s.editor.setCell(chosen.employeeId, date, templateId);
    setChosenId(null);
  };

  return (
    <div className="flex min-h-full flex-col bg-wds-surface">
      <header className="flex items-start gap-3 border-b border-wds-border px-4 py-3.5">
        <Link href="/app/workforce" aria-label="Back to Home" className={cn('-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[20px] text-wds-text-ink', FOCUS_RING)}>
          <span aria-hidden>‹</span>
        </Link>
        <div className="flex min-w-0 grow flex-col">
          <h1 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{departmentName === 'Everyone' ? 'Shifts' : `${departmentName} shifts`}</h1>
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {weekPhoneRange(data.weekStart)} · {people.length} {people.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="flex shrink-0">
          {([-1, 1] as const).map((by) => (
            <button key={by} type="button" aria-label={by < 0 ? 'Previous week' : 'Next week'} disabled={by < 0 ? s.previousDisabled : s.nextDisabled} onClick={() => s.stepWeek(by)} className={cn('flex h-11 w-9 items-center justify-center text-[18px] text-wds-text-ink disabled:opacity-40', MOTION, FOCUS_RING)}>
              <span aria-hidden>{by < 0 ? '‹' : '›'}</span>
            </button>
          ))}
        </div>
      </header>
      {deptId === ALL_DEPARTMENTS && departments.length > 1 ? (
        <div className="border-b border-wds-border px-4 py-2.5">
          <Picker aria-label="Department" value={s.departmentId} onValueChange={s.setDepartment} chips={false} options={[{ value: ALL_DEPARTMENTS, label: 'All departments' }, ...departments.map((d) => ({ value: d.id ?? '', label: d.name }))]} />
        </div>
      ) : null}
      <DayStrip
        label="Day of the week"
        value={date}
        onChange={(v) => {
          setDate(v);
          setChosenId(null);
        }}
        days={data.days.map((d) => ({ value: d.date, dow: weekdayName(d.date).slice(0, 3).toUpperCase(), day: String(dayOfMonth(d.date)) }))}
      />
      <div className="flex grow flex-col gap-2.5 bg-wds-canvas px-4 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{longDay(date)}</h2>
          <span className={cn('font-wds-mono text-[12px] leading-4', thin ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>{needs === null ? `Has ${working}` : `Needs ${needs} · has ${working}`}</span>
        </div>
        {people.length === 0 ? <EmptyState kind="nothingYet" title={NO_ONE_ON_ROTA.title} line={NO_ONE_ON_ROTA.body} /> : null}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {people.map((p) => {
            const shifts = p.cells[date] ?? [];
            const first = shifts[0] ? templates.get(shifts[0].templateId) : undefined;
            const open = canWrite ? () => setChosenId(p.employeeId === chosenId ? null : p.employeeId) : undefined;
            const role = data.departments.find((d) => d.id === p.departmentId)?.headName === p.name ? 'Head' : (p.positionName ?? '');
            return (
              <li key={p.employeeId} className={cn('flex min-h-[60px] items-center justify-between gap-3 border bg-wds-surface px-3.5 py-2.5', p.employeeId === chosenId ? 'border-wds-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--wds-primary)_12%,transparent)]' : 'border-wds-border')}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-wds-sans text-[15px] leading-5 text-wds-text-ink">{p.name}</span>
                  <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{role}</span>
                </span>
                {first ? (
                  <ShiftChip tone={toneOfColour(first.colour)} label={cellNameOf(first)} onSelect={open} ariaLabel={`${p.name}, ${first.name} ${first.startTime} to ${first.endTime}. Change shift`} />
                ) : p.leaveDates.includes(date) ? (
                  <ShiftChip tone="leave" label="Leave" onSelect={open} ariaLabel={`${p.name}, on leave. Pick a shift`} />
                ) : canWrite ? (
                  <PickShiftButton onClick={() => open?.()} ariaLabel={`Pick a shift for ${p.name}`} />
                ) : (
                  <span aria-label={`${p.name}, no shift`} className="font-wds-sans text-[13px] text-wds-neutral-400">
                    —
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {chosen && canWrite ? (
          <PhoneShiftSheet title={`${chosen.name} · ${weekdayName(date)}`} options={data.templates.filter((t) => templateFits(t, chosen.departmentId))} currentIds={(chosen.cells[date] ?? []).map((x) => x.templateId)} onPick={pick} />
        ) : null}
      </div>
      <p className="m-0 border-t border-wds-border bg-wds-surface px-4 py-3.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {data.can.write ? 'Saves as you go. People are told when their shift changes. Nothing waits for approval.' : 'You can read these shifts but not change them.'}
      </p>
      <PendingDialogs week={data} pending={s.editor.pending} answer={s.editor.answer} cancel={s.editor.cancel} />
    </div>
  );
}
