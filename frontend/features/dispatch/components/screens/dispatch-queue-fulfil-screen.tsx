'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { StatusDot } from '@/components/ui2/status-dot';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWdsToast } from '@/hooks/useWdsToast';
import { useDispatchQueue } from '../../hooks/use-dispatch-queue';
import { useDispatchFulfil } from '../../hooks/use-dispatch-fulfil';
import { DispatchFulfilSkeletonDesktop, DispatchKpiSkeletonDesktop, DispatchQueueRailSkeletonDesktop } from '../skeletons';
import { DispatchQueueScreenMobile } from './dispatch-queue-screen-mobile';
import { DispatchFulfilScreenMobile } from './dispatch-fulfil-screen-mobile';
import type { DepartmentTag, DispatchQueueRow, FulfilLine, FulfilSection } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function requisitionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** "3h 40m" from an ISO timestamp — Paper's oldest-wait / queue-age format. */
function formatWait(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function outOfLabel(row: DispatchQueueRow): string {
  const dispatched = row.departments.filter((d) => d.status !== null).length;
  return `${dispatched} of ${row.departments.length} out`;
}

interface DispatchLineRowProps {
  line: FulfilLine;
  onChange: (value: string) => void;
  readOnly: boolean;
}

function DispatchLineRow({ line, onChange, readOnly }: DispatchLineRowProps) {
  const requested = line.requestedQty ?? '—';
  const short = line.requestedQty !== null && Number(line.dispatchQty) < Number(line.requestedQty);
  const shortBy = short ? Number(line.requestedQty) - Number(line.dispatchQty) : 0;

  return (
    <div className="flex items-center gap-3 border-t border-t-solid border-t-wds-neutral-200 py-2">
      <div className="min-w-0 grow basis-0 flex items-baseline gap-1.5">
        <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">
          {line.itemName} · {line.usageUnit}
        </span>
        {short ? (
          <span className="font-wds-sans text-wds-label text-wds-warning-fg">
            {shortBy} short — not an error, carries to next requisition
          </span>
        ) : null}
      </div>
      <div className="w-[70px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{requested}</div>
      <div
        className={
          'w-[70px] shrink-0 text-right font-wds-mono text-wds-body-sm ' +
          (short ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')
        }
      >
        {line.onHandQty}
      </div>
      <div className="w-[110px] shrink-0 flex justify-end pr-2">
        {readOnly ? (
          <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">{line.dispatchQty}</span>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            value={line.dispatchQty}
            onChange={(e) => onChange(e.target.value)}
            className={
              'w-16 cursor-text rounded-wds-sm border bg-wds-surface py-0.5 px-2 text-right font-wds-mono text-wds-body-sm font-semibold outline-none transition-colors hover:border-wds-border-strong focus-visible:border-wds-primary focus-visible:shadow-wds-ring ' +
              (short ? 'border-wds-primary text-wds-primary' : 'border-wds-border text-wds-text-ink')
            }
          />
        )}
      </div>
    </div>
  );
}

interface SectionBlockProps {
  section: FulfilSection;
  lines: FulfilLine[];
  onLineChange: (inventoryItemId: string, value: string) => void;
  onDispatch: (departmentTag: DepartmentTag) => void;
  dispatching: boolean;
  sectionError: string | null;
}

function SectionBlock({ section, lines, onLineChange, onDispatch, dispatching, sectionError }: SectionBlockProps) {
  const totalUnits = lines.reduce((sum, l) => sum + Number(l.dispatchQty), 0);
  const fullLineCount = lines.filter((l) => l.requestedQty === null || Number(l.dispatchQty) >= Number(l.requestedQty)).length;

  // Already dispatched/confirmed — collapsed one-line summary, no editable table.
  // Transition covers the swap from the editable table above (#42) — a
  // fade+height change rather than a hard re-render, since this is the
  // screen's most consequential action and users watch it closely.
  if (section.dispatchStatus) {
    const statusLabel =
      section.dispatchStatus === 'IN_TRANSIT'
        ? 'In Transit'
        : section.dispatchStatus === 'CONFIRMED'
          ? 'Confirmed'
          : 'Discrepancy';
    const tone =
      section.dispatchStatus === 'CONFIRMED'
        ? 'success'
        : section.dispatchStatus === 'DISCREPANCY_OPEN'
          ? 'error'
          : 'warning';
    return (
      <div className="flex animate-in items-baseline justify-between border-t border-t-solid border-t-wds-neutral-800 py-3.5 fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
        <div className="flex items-baseline gap-2">
          <div className="font-wds-sans text-[15px]/[20px] font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">
            {lines.length} line{lines.length === 1 ? '' : 's'} · fully sent
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <StatusDot tone={tone} className="text-wds-caption">{statusLabel}</StatusDot>
          {section.dispatchId ? (
            <a
              href={`/app/inventory/dispatch/${section.dispatchId}`}
              className="font-wds-sans text-wds-caption text-wds-primary underline decoration-wds-primary underline-offset-2 outline-none transition-colors hover:text-wds-primary-hover focus-visible:shadow-wds-ring"
            >
              View note
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-t-solid border-t-wds-neutral-800 py-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <div className="font-wds-sans text-[15px]/[20px] font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">{lines.length} lines · {totalUnits} units to go out</div>
        </div>
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Awaiting dispatch</div>
      </div>
      <div className="flex items-center gap-3 py-1.5">
        <div className="grow basis-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Item</div>
        <div className="w-[70px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
          Requested
        </div>
        <div className="w-[70px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
          On hand
        </div>
        <div className="w-[110px] shrink-0 text-right pr-2 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
          Dispatch
        </div>
      </div>
      {lines.map((line) => (
        <DispatchLineRow key={line.inventoryItemId} line={line} onChange={(v) => onLineChange(line.inventoryItemId, v)} readOnly={false} />
      ))}
      {sectionError ? (
        <div role="alert" className="rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5">
          <div className="font-wds-sans text-wds-caption text-wds-error-fg">{sectionError}</div>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-t border-t-solid border-t-wds-neutral-200 pt-2.5">
        <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          {fullLineCount} of {lines.length} lines full
        </div>
        <Button
          size="sm"
          disabled={dispatching || totalUnits === 0}
          title={totalUnits === 0 ? 'Enter at least one unit to dispatch before signing' : undefined}
          onClick={() => onDispatch(section.departmentTag)}
        >
          {dispatching ? (
            <>
              <Loader2 className="animate-spin" />
              Dispatching…
            </>
          ) : (
            <>Sign &amp; dispatch {DEPARTMENT_LABEL[section.departmentTag]}</>
          )}
        </Button>
      </div>
    </div>
  );
}

export interface DispatchQueueFulfilScreenProps {
  requisitionId?: string;
}

/**
 * Central Store desktop master-detail (`15V5-0`) — queue rail + fulfil
 * detail. Measured from Paper via `get_jsx`: list rail 340px, detail column
 * grows, Item/Requested(70px)/On hand(70px)/Dispatch(110px) columns,
 * right-aligned font-mono. Already-dispatched/confirmed departments render
 * as a collapsed one-line summary inline, not a separate screen.
 */
export function DispatchQueueFulfilScreen({ requisitionId }: DispatchQueueFulfilScreenProps) {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const queue = useDispatchQueue();
  const {
    detail,
    visibleLinesBySection,
    setLineEdit,
    dispatchSection,
    dispatchingSection,
    dispatchError,
    status,
    error,
    reload,
  } = useDispatchFulfil(requisitionId ?? '');

  const [signTarget, setSignTarget] = React.useState<DepartmentTag | null>(null);
  const [lastFailedSection, setLastFailedSection] = React.useState<DepartmentTag | null>(null);
  const { toast } = useWdsToast();

  const branchesWaiting = queue.rows.length;
  const departmentsWaiting = queue.rows.reduce((sum, r) => sum + r.departments.filter((d) => d.status === null).length, 0);
  const oldest = queue.rows[0] ?? null;
  const dispatchedToday = queue.rows.reduce((sum, r) => sum + r.departments.filter((d) => d.status !== null).length, 0);

  const branchesFullyOut = queue.rows.filter((r) => r.departments.every((d) => d.status !== null)).length;

  const kpis = [
    { label: 'Branches waiting', value: String(branchesWaiting), detail: branchesWaiting > 0 ? `${branchesWaiting} branch${branchesWaiting === 1 ? '' : 'es'} raised a requisition` : 'nothing waiting' },
    { label: 'Departments waiting', value: String(departmentsWaiting), detail: `across the ${branchesWaiting} waiting branches` },
    { label: 'Oldest wait', value: oldest ? formatWait(oldest.openedAt) : '—', detail: oldest ? `${oldest.branchName} · opened ${formatTime(oldest.openedAt)}` : 'nothing waiting', accent: true },
    { label: 'Dispatched today', value: String(dispatchedToday), detail: `${branchesFullyOut} branch${branchesFullyOut === 1 ? '' : 'es'} fully out` },
  ];

  const handleSign = async (pin: string) => {
    if (!signTarget) return;
    const dept = signTarget;
    const lines = visibleLinesBySection[dept] ?? [];
    const shortCount = lines.filter((l) => l.requestedQty !== null && Number(l.dispatchQty) < Number(l.requestedQty)).length;
    setLastFailedSection(null);
    const ok = await dispatchSection(dept, pin);
    if (ok) {
      setSignTarget(null);
      toast({
        variant: 'success',
        title: `${DEPARTMENT_LABEL[dept]} dispatched`,
        description: `${lines.length} line${lines.length === 1 ? '' : 's'}${shortCount > 0 ? `, ${shortCount} short` : ''}`,
      });
    } else {
      setLastFailedSection(dept);
    }
  };

  if (!hydrated) return null;

  if (!isDesktop) {
    return requisitionId ? <DispatchFulfilScreenMobile requisitionId={requisitionId} /> : <DispatchQueueScreenMobile />;
  }

  if (queue.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Dispatch' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load the dispatch queue" description="Check your connection and try again." onRetry={queue.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Dispatch' }}
        actions={
          <Button variant="secondary" onClick={() => router.push('/app/inventory/discrepancies')}>
            Discrepancies
          </Button>
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-1 px-8 pb-5 pt-7">
          <h1 className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Dispatch</h1>
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            Approved branch requisitions waiting to be picked, packed and signed out — oldest first.
          </p>
        </div>

        {queue.status === 'loading' ? (
          <DispatchKpiSkeletonDesktop />
        ) : (
          <div className="mx-8 mb-5 flex overflow-hidden rounded-wds-sm border border-wds-border">
            {kpis.map((kpi, i) => (
              <div key={kpi.label} className={'flex grow basis-0 flex-col gap-1.5 px-5 py-4 ' + (i > 0 ? 'border-l border-l-wds-border' : '')}>
                <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">{kpi.label}</div>
                <div className={'font-wds-mono text-wds-kpi font-semibold ' + (kpi.accent ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{kpi.value}</div>
                <div className="font-wds-sans text-wds-caption text-wds-text-faint">{kpi.detail}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 border-t border-t-solid border-t-wds-neutral-800">
          <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-r-solid border-r-wds-neutral-800">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Waiting</div>
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">Queue order fixed — oldest first</div>
            </div>
            {queue.status === 'loading' ? (
              <DispatchQueueRailSkeletonDesktop />
            ) : queue.rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Nothing waiting to dispatch.</div>
              </div>
            ) : (
              queue.rows.map((row) => {
                const href = `/app/inventory/dispatch?id=${row.requisitionId}`;
                return (
                  <a
                    key={row.requisitionId}
                    href={href}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      router.push(href, { scroll: false });
                    }}
                    className={
                      'flex cursor-pointer flex-col gap-1 border-l-2 border-l-solid px-4 py-3 transition-colors hover:bg-wds-neutral-100 active:bg-wds-neutral-200 ' +
                      (row.requisitionId === requisitionId ? 'border-l-wds-primary bg-wds-neutral-100' : 'border-l-transparent')
                    }
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">{row.branchName}</div>
                      <div className="font-wds-mono text-wds-caption text-wds-warning-fg">{formatWait(row.openedAt)}</div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                        {requisitionTypeLabel(row.requisitionType)} · opened {formatTime(row.openedAt)}
                      </div>
                      <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{outOfLabel(row)}</div>
                    </div>
                  </a>
                );
              })
            )}
          </div>

          <div className="flex min-w-0 grow basis-0 flex-col overflow-y-auto">
            {!requisitionId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-[120px]">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-wds-sm border-[1.5px] border-solid border-wds-border-strong">
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.75" />
                    <circle cx="7.5" cy="17.5" r="2.5" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.75" />
                    <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.75" />
                  </svg>
                </div>
                <div className="font-wds-sans text-wds-section font-medium text-wds-text-ink">Select a branch</div>
                <div className="max-w-[280px] text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                  Choose one from the queue to enter what&apos;s going out and sign each department.
                </div>
              </div>
            ) : status === 'loading' ? (
              <DispatchFulfilSkeletonDesktop />
            ) : status === 'error' ? (
              <div className="flex flex-1 items-center justify-center">
                <ErrorState title="Couldn't load this requisition" description={error ?? 'Try again.'} onRetry={reload} />
              </div>
            ) : !detail ? null : (
              <>
                <div className="flex flex-col gap-1 px-8 pb-4 pt-5">
                  <div className="font-wds-sans text-[20px]/6 font-semibold tracking-tight text-wds-text-ink">{detail.branchName}</div>
                  <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                    {requisitionTypeLabel(detail.requisitionType)} · opened {formatTime(detail.openedAt)}. Enter what&apos;s actually going out, then
                    sign each department as it&apos;s ready.
                  </div>
                </div>
                <div className="mx-8 mb-6 mt-4 flex flex-col gap-0">
                  {detail.sections.map((section) => (
                    <SectionBlock
                      key={section.departmentTag}
                      section={section}
                      lines={visibleLinesBySection[section.departmentTag] ?? section.lines}
                      onLineChange={(itemId, value) => setLineEdit(itemId, { dispatchQty: value })}
                      onDispatch={(dept) => setSignTarget(dept)}
                      dispatching={dispatchingSection === section.departmentTag}
                      sectionError={lastFailedSection === section.departmentTag ? dispatchError : null}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <SignSheetDialog
        open={signTarget !== null}
        onOpenChange={(open) => !open && setSignTarget(null)}
        title="Sign to dispatch"
        subtitle={signTarget ? `Enter your PIN to sign and dispatch ${DEPARTMENT_LABEL[signTarget]}.` : ''}
        helperText="Signing confirms what's actually going out with the driver."
        confirmLabel="Sign & dispatch"
        onSubmit={handleSign}
        submitting={dispatchingSection !== null}
        error={dispatchError ?? undefined}
      />
    </div>
  );
}
