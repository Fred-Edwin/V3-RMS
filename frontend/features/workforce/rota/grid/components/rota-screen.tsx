'use client';

import Link from 'next/link';
import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

import { DialogButton, EmptyState, ErrorBlock, FOCUS_RING, ListSkeleton, PageHeader, PeriodStepper, ShiftLegend, WorkforceFrame } from '../../../_shared';
import { CopyDayDialog } from '../../dialogs/copy-day-dialog';
import { CopyWeekDialog } from '../../dialogs/copy-week-dialog';
import { PendingDialogs } from '../../dialogs/pending-dialogs';
import { RotaPhone } from '../../phone/components/rota-phone';
import { GRID_NOTE, GRID_NOTE_READ_ONLY, GRID_NOTE_SITES, LEFT_NOTE, LEFT_NOTE_SITES, NO_ACCESS, NO_ONE_ON_ROTA } from '../../_shared/lib/rota-copy';
import { weekLabel } from '../../_shared/lib/rota-dates';
import { timeRangeWords, toneOfColour } from '../../_shared/lib/shift-look';
import { ALL_DEPARTMENTS, listedDepartments, peopleIn, warningsIn } from '../../_shared/lib/week-view';
import type { WeekView } from '../../_shared/types/rota-types';
import { useRotaSelection } from '../hooks/use-rota-selection';
import { departmentItems, siteItems } from '../lib/side-items';
import { RotaGridView } from './rota-grid-view';
import { RotaKpis } from './rota-kpis';
import { RotaSideList } from './rota-side-list';
import { RotaTopActions } from './rota-top-actions';
import { WarningsList } from './warnings-list';

const TEMPLATES_HREF = '/app/workforce/schedule/templates';

/** The shifts used by the people in view, one per colour, for the legend over the grid. */
function legendOf(week: WeekView, people: ReturnType<typeof peopleIn>) {
  const used = new Set(people.flatMap((p) => Object.values(p.cells).flatMap((day) => day.map((s) => s.templateId))));
  const seen = new Set<string>();
  const items = week.templates
    .filter((t) => used.has(t.id))
    .flatMap((t) => {
      const tone = toneOfColour(t.colour);
      if (seen.has(tone)) return [];
      seen.add(tone);
      return [{ tone, label: `${t.name} ${timeRangeWords(t)}` }];
    });
  return people.some((p) => p.leaveDates.length > 0) && !seen.has('leave') ? [...items, { tone: 'leave' as const, label: 'Leave' }] : items;
}

/** The Rota (Paper Chapter 5, steps 1 to 5 and 8). Every edit saves at once; there is no publish step. */
export function RotaScreen() {
  const s = useRotaSelection();
  const phone = useMediaQuery('(max-width: 767px)');
  const [copyingWeek, setCopyingWeek] = React.useState(false);
  const [copyingDay, setCopyingDay] = React.useState(false);
  const warningsRef = React.useRef<HTMLElement>(null);
  const { week, editor, departmentId } = s;
  const data = week.data;
  const canWrite = data?.can.write ?? false;

  const frame = (body: React.ReactNode, actions?: React.ReactNode) => (
    <WorkforceFrame breadcrumb={{ section: 'Schedule', screen: 'Rota' }} phoneTitle="Rota" label="Rota" actions={actions}>
      {body}
    </WorkforceFrame>
  );

  if (!s.perms.ready && !s.perms.failed) return frame(<ListSkeleton rows={6} label="Loading the rota" className="m-8" />);
  if (s.perms.failed || !s.canRead) return frame(<EmptyState kind="nothingYet" title={NO_ACCESS.title} line={NO_ACCESS.body} className="m-8" />);
  if (week.status === 'error' && !data) {
    const refused = week.error.status === 403 || week.error.status === 404;
    return frame(
      refused ? <EmptyState kind="nothingYet" title={NO_ACCESS.title} line={NO_ACCESS.body} className="m-8" /> : <ErrorBlock title="Could not load the rota" line={week.error.message} reference={week.error.code} onRetry={week.reload} className="m-8" />
    );
  }
  if (!data) return frame(<ListSkeleton rows={6} label="Loading the rota" className="m-8" />);

  const people = peopleIn(data, departmentId);
  const warnings = warningsIn(data, departmentId);
  const departmentName = departmentId === ALL_DEPARTMENTS ? 'All departments' : (data.departments.find((d) => d.id === departmentId)?.name ?? '');
  const printHref = `/app/workforce/schedule/rota/print?week=${s.weekStart}${s.siteId ? `&site=${s.siteId}` : ''}${departmentId !== ALL_DEPARTMENTS ? `&dept=${departmentId}` : ''}`;

  if (phone.matches) return frame(<RotaPhone selection={s} data={data} />);

  const side = s.readsAllSites ? (
    <RotaSideList caption="SITES" items={siteItems(s.sites, s.siteId, data)} value={s.siteId ?? ''} onChange={s.setSite} note={LEFT_NOTE_SITES} />
  ) : (
    <RotaSideList caption="DEPARTMENTS" items={departmentItems(data)} value={departmentId} onChange={s.setDepartment} note={LEFT_NOTE} />
  );
  const legend = legendOf(data, people);

  return frame(
    <div className="flex flex-col gap-5 px-8 pb-10 pt-7">
      <PageHeader
        title={`Rota · ${s.siteName || 'Site'}`}
        subtitle={
          <PeriodStepper label={weekLabel(data.weekStart)} previousLabel="Previous week" nextLabel="Next week" onPrevious={() => s.stepWeek(-1)} onNext={() => s.stepWeek(1)} previousDisabled={s.previousDisabled} nextDisabled={s.nextDisabled} />
        }
        actions={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legend.length > 0 ? <ShiftLegend items={legend} /> : null}
            {data.can.writeTemplates ? (
              <Link href={TEMPLATES_HREF} className={cn('font-wds-sans text-[13px] font-medium leading-4 text-wds-primary', FOCUS_RING)}>
                Edit shifts →
              </Link>
            ) : null}
          </div>
        }
      />
      <RotaKpis week={data} departmentId={departmentId} departmentName={departmentName} onNeedsLook={() => warningsRef.current?.focus()} />
      <div className="flex flex-col border-t border-wds-text-ink lg:flex-row">
        {side}
        <section aria-label={departmentName} className="flex min-w-0 flex-1 flex-col gap-3 pt-4 lg:pl-6">
          {s.readsAllSites ? (
            <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{GRID_NOTE_SITES}</p>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{departmentName}</h2>
              {canWrite ? (
                <DialogButton kind="cancel" onClick={() => setCopyingDay(true)}>
                  Copy day
                </DialogButton>
              ) : null}
            </div>
          )}
          {s.readsAllSites ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">DEPARTMENT</span>
                <Picker aria-label="Department" value={departmentId} onValueChange={s.setDepartment} chips={false} className="h-8 w-[160px]" options={[{ value: ALL_DEPARTMENTS, label: 'All departments' }, ...listedDepartments(data).map((d) => ({ value: d.id ?? '', label: d.name }))]} />
              </div>
              {canWrite ? (
                <DialogButton kind="cancel" onClick={() => setCopyingDay(true)}>
                  Copy day
                </DialogButton>
              ) : null}
            </div>
          ) : null}
          {people.length === 0 ? (
            <EmptyState kind="nothingYet" title={NO_ONE_ON_ROTA.title} line={NO_ONE_ON_ROTA.body} />
          ) : (
            <RotaGridView week={data} people={people} warnings={warnings} departmentId={departmentId} canWrite={canWrite} editShiftsHref={data.can.writeTemplates ? TEMPLATES_HREF : undefined} editor={editor} />
          )}
          <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{s.readsAllSites ? '' : canWrite ? GRID_NOTE : GRID_NOTE_READ_ONLY}</p>
          <WarningsList ref={warningsRef} warnings={warnings} />
        </section>
      </div>
      {copyingWeek ? (
        <CopyWeekDialog siteId={s.siteId} weekStart={data.weekStart} departmentId={departmentId === ALL_DEPARTMENTS ? undefined : departmentId} departmentName={departmentId === ALL_DEPARTMENTS ? null : departmentName} run={editor.runWrite} onClose={() => setCopyingWeek(false)} />
      ) : null}
      {copyingDay ? <CopyDayDialog week={data} people={people} title={departmentName} onCopy={editor.setMany} onClose={() => setCopyingDay(false)} /> : null}
      <PendingDialogs week={data} pending={editor.pending} answer={editor.answer} cancel={editor.cancel} />
    </div>,
    <RotaTopActions status={editor.status} printHref={printHref} onStartFromLastWeek={canWrite ? () => setCopyingWeek(true) : undefined} />
  );
}
