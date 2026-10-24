'use client';

import * as React from 'react';

import { ShiftGrid, positionWords, type ShiftGridRow } from '../../../_shared';
import { cellChangeFor } from '../lib/grid-keys';
import { dragDates } from '../../_shared/lib/rota-edits';
import { columnHead, longDay, weekLabel } from '../../_shared/lib/rota-dates';
import { cellLabelOf, hoursNumber, templateFits, timeRangeWords, toneOfColour } from '../../_shared/lib/shift-look';
import { ALL_DEPARTMENTS, cellWarnings, footerRow, personNote } from '../../_shared/lib/week-view';
import type { GridPerson, RotaWarning, TemplateView, WeekView } from '../../_shared/types/rota-types';
import { CellPopover } from './cell-popover';

interface Opened {
  person: GridPerson;
  date: string;
  opener: HTMLElement;
}

interface Drag {
  person: GridPerson;
  from: number;
  to: number;
  templateId: string;
}

/**
 * The week grid of the Rota (Paper steps 1, 2 and 8): the kit's `ShiftGrid` with data, the cell picker, drag across a row to fill,
 * letter keys and Delete, and arrow keys between cells. A cell is editable only when the server says the viewer may write and the day
 * has not passed. Edits go to `editor`, which saves them at once.
 */
export function RotaGridView({
  week,
  people,
  warnings,
  departmentId,
  canWrite,
  editShiftsHref,
  editor,
}: {
  week: WeekView;
  people: readonly GridPerson[];
  warnings: readonly RotaWarning[];
  departmentId: string;
  canWrite: boolean;
  editShiftsHref?: string;
  editor: { setCell: (employeeId: string, date: string, templateId: string | null) => void; fillRow: (employeeId: string, dates: string[], templateId: string | null) => void };
}) {
  const [opened, setOpened] = React.useState<Opened | null>(null);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const focusAfter = React.useRef<{ row: string; day: number; week: WeekView } | null>(null);
  const templates = React.useMemo(() => new Map(week.templates.map((t) => [t.id, t] as const)), [week.templates]);
  const flagged = React.useMemo(() => cellWarnings(warnings), [warnings]);
  const dates = week.days.map((d) => d.date);
  const departmentName = (id: string | null): string => week.departments.find((d) => d.id === id)?.name ?? '';
  const headNameOf = (id: string | null): string | null => week.departments.find((d) => d.id === id)?.headName ?? null;

  // After a keyboard edit the cell is rebuilt; put focus back on it once the saved week has arrived.
  React.useLayoutEffect(() => {
    const want = focusAfter.current;
    if (!want || want.week === week) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(`td[data-row="${want.row}"][data-day="${want.day}"] button`)?.focus();
  });

  const startDrag = (e: React.PointerEvent): void => {
    if (!canWrite) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('td[data-row]');
    const person = people.find((p) => p.employeeId === cell?.dataset.row);
    const day = Number(cell?.dataset.day);
    const date = dates[day];
    const shifts = person && date ? (person.cells[date] ?? []) : [];
    if (!person || !date || shifts.length === 0 || week.days[day]?.isPast) return;
    const next = { person, from: day, to: day, templateId: shifts[0]?.templateId ?? '' };
    dragRef.current = next;
    setDrag(next);
  };
  const overCell = (e: React.PointerEvent): void => {
    const current = dragRef.current;
    const cell = (e.target as HTMLElement).closest<HTMLElement>('td[data-row]');
    if (!current || !cell || cell.dataset.row !== current.person.employeeId) return;
    const next = { ...current, to: Number(cell.dataset.day) };
    dragRef.current = next;
    setDrag(next);
  };
  React.useEffect(() => {
    const finish = (): void => {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || current.from === current.to) return;
      focusAfter.current = { row: current.person.employeeId, day: current.to, week };
      editor.fillRow(current.person.employeeId, dragDates(dates, current.from, current.to, week.today), current.templateId);
    };
    window.addEventListener('pointerup', finish);
    return () => window.removeEventListener('pointerup', finish);
  });

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('td[data-row]');
    if (!cell || e.metaKey || e.ctrlKey || e.altKey) return;
    const row = cell.dataset.row ?? '';
    const day = Number(cell.dataset.day);
    const move = (r: Element | null, d: number): void => {
      e.preventDefault();
      r?.querySelector<HTMLElement>(`td[data-day="${d}"] button`)?.focus();
    };
    const tr = cell.closest('tr');
    if (e.key === 'ArrowLeft') return move(tr, day - 1);
    if (e.key === 'ArrowRight') return move(tr, day + 1);
    if (e.key === 'ArrowUp') return move(tr?.previousElementSibling ?? null, day);
    if (e.key === 'ArrowDown') return move(tr?.nextElementSibling ?? null, day);
    const person = people.find((p) => p.employeeId === row);
    const date = dates[day];
    if (!canWrite || !person || !date || week.days[day]?.isPast) return;
    const change = cellChangeFor(e.key, week.templates.filter((t) => templateFits(t, person.departmentId)));
    if (change === undefined) return;
    e.preventDefault();
    focusAfter.current = { row, day, week };
    editor.setCell(person.employeeId, date, change);
  };

  const pick = (templateId: string | null): void => {
    if (!opened) return;
    const index = dates.indexOf(opened.date);
    focusAfter.current = { row: opened.person.employeeId, day: index, week };
    editor.setCell(opened.person.employeeId, opened.date, templateId);
    setOpened(null);
  };

  const rows: ShiftGridRow[] = people.map((person) => {
    const note = personNote(person, warnings);
    const isHead = headNameOf(person.departmentId) === person.name;
    const role = positionWords(person.positionName, isHead) ?? '';
    const sub = note ?? (departmentId === ALL_DEPARTMENTS ? Array.from(new Set([departmentName(person.departmentId), role].filter(Boolean))).join(' · ') : role);
    return {
      id: person.employeeId,
      name: person.name,
      sub,
      subTone: note ? 'warning' : 'default',
      hours: hoursNumber(person.plannedMinutes),
      cells: week.days.map((day, i) => {
        const shifts = person.cells[day.date] ?? [];
        const editable = canWrite && !day.isPast;
        const open = editable ? (opener: HTMLElement) => setOpened({ person, date: day.date, opener }) : undefined;
        const inDrag = drag?.person.employeeId === person.employeeId && i >= Math.min(drag.from, drag.to) && i <= Math.max(drag.from, drag.to);
        const chosen = inDrag || (opened?.person.employeeId === person.employeeId && opened.date === day.date);
        const warned = flagged.get(`${person.employeeId}|${day.date}`) ?? [];
        const spoken = `${person.name}, ${columnHead(day.date)}`;
        const first = shifts[0] ? templates.get(shifts[0].templateId) : undefined;
        if (first) {
          return {
            tone: toneOfColour(first.colour),
            label: cellLabelOf(first) + (shifts.length > 1 ? ` +${shifts.length - 1}` : ''),
            title: `${first.name} ${timeRangeWords(first)}`,
            flagged: warned.length > 0 || shifts.length > 1,
            chosen,
            ariaLabel: [`${spoken}, ${first.name} ${timeRangeWords(first)}`, ...warned.map((w) => w.message)].join('. '),
            onSelect: open,
          };
        }
        if (person.leaveDates.includes(day.date)) return { tone: 'leave' as const, label: 'Leave', chosen, ariaLabel: `${spoken}, on leave`, onSelect: open };
        return { empty: true as const, chosen, ariaLabel: `${spoken}, no shift`, onSelect: open };
      }),
    };
  });

  const footer = footerRow(week, departmentId, warnings);
  const title = departmentId === ALL_DEPARTMENTS ? 'All departments' : departmentName(departmentId);
  const options: TemplateView[] = opened ? week.templates.filter((t) => templateFits(t, opened.person.departmentId)) : [];

  return (
    <div onPointerDown={startDrag} onPointerOver={overCell} onKeyDown={onKeyDown} className="select-none">
      <ShiftGrid label={`${title} shifts, ${weekLabel(week.weekStart)}`} days={week.days.map((d) => columnHead(d.date))} rows={rows} footer={footer} className="max-w-full" />
      {opened ? (
        <CellPopover
          opener={opened.opener}
          title={opened.person.name}
          subtitle={`${longDay(opened.date)} · ${opened.person.positionName ?? departmentName(opened.person.departmentId)}`}
          options={options}
          onLeaveNote={opened.person.leaveDates.includes(opened.date) ? `${opened.person.name.split(' ')[0]} is on approved leave this day. A shift here asks you to say why.` : undefined}
          currentIds={(opened.person.cells[opened.date] ?? []).map((s) => s.templateId)}
          onPick={pick}
          onClose={() => setOpened(null)}
          editShiftsHref={editShiftsHref}
        />
      ) : null}
    </div>
  );
}
