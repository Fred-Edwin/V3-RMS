'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { StatusDot } from '@/components/ui2/status-dot';
import { useDispatchFulfil } from '../../hooks/use-dispatch-fulfil';
import { DispatchFulfilSkeletonMobile } from '../skeletons';
import type { DepartmentTag, FulfilLine } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

interface StepperLineCardProps {
  line: FulfilLine;
  onChange: (value: string) => void;
}

function StepperLineCard({ line, onChange }: StepperLineCardProps) {
  const short = line.requestedQty !== null && Number(line.dispatchQty) < Number(line.requestedQty);
  const shortBy = short ? Number(line.requestedQty) - Number(line.dispatchQty) : 0;
  const canDecrement = Number(line.dispatchQty) > 0;
  const canIncrement = Number(line.dispatchQty) < Number(line.onHandQty);

  const step = (delta: number) => {
    const next = Math.max(0, Number(line.dispatchQty) + delta);
    onChange(String(next));
  };

  return (
    <div className={'flex flex-col gap-wds-2.5 rounded-wds-sm border bg-wds-surface p-wds-3.5 ' + (short ? 'border-wds-warning-border' : 'border-wds-border')}>
      <div className="flex items-center justify-between">
        <div className="font-wds-sans text-[15px]/[20px] font-medium text-wds-text-ink">{line.itemName}</div>
        {short ? <div className="font-wds-sans text-wds-label text-wds-warning-fg">{shortBy} {line.usageUnit} short</div> : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-px">
          <div className="font-wds-mono text-[10px]/3 text-wds-text-copy-muted">REQUESTED</div>
          <div className="font-wds-mono text-wds-body-sm text-wds-text-ink">{line.requestedQty ?? '—'} {line.usageUnit}</div>
        </div>
        <div className="flex flex-col gap-px">
          <div className="font-wds-mono text-[10px]/3 text-wds-text-copy-muted">ON HAND</div>
          <div className={'font-wds-mono text-wds-body-sm ' + (short ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{line.onHandQty} {line.usageUnit}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="font-wds-mono text-[10px]/3 text-wds-text-copy-muted">DISPATCH</div>
        <div className="flex items-center overflow-hidden rounded-wds-sm border border-wds-border-strong">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canDecrement}
            aria-label={`Decrease dispatch quantity for ${line.itemName}`}
            className={'px-wds-3.25 py-2 font-wds-mono text-section disabled:opacity-40 ' + (canDecrement ? 'text-wds-primary' : 'text-wds-text-copy-muted')}
          >
            −
          </button>
          <div className="border-x border-wds-border px-4 py-2 font-wds-mono text-section text-wds-text-ink">{line.dispatchQty}</div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canIncrement}
            aria-label={`Increase dispatch quantity for ${line.itemName}`}
            className={'px-wds-3.25 py-2 font-wds-mono text-section disabled:opacity-40 ' + (canIncrement ? 'text-wds-primary' : 'text-wds-text-copy-muted')}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export interface DispatchFulfilScreenMobileProps {
  requisitionId: string;
}

/**
 * Fulfil & dispatch — mobile full-screen task (`1523-0` populated, `154G-0`
 * mid-signature). Department tab bar (dark header), per-item stepper cards,
 * short-line warning banner, sticky footer with line summary + sign CTA.
 * PIN sheet reuses `SignSheetDialog` verbatim (already built, GEO-0
 * precedent per sign-sheet.tsx's own header comment).
 */
export function DispatchFulfilScreenMobile({ requisitionId }: DispatchFulfilScreenMobileProps) {
  const router = useRouter();
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
  } = useDispatchFulfil(requisitionId);

  const [activeDept, setActiveDept] = React.useState<DepartmentTag | null>(null);
  const [signOpen, setSignOpen] = React.useState(false);

  const dispatchableSections = React.useMemo(() => detail?.sections.filter((s) => !s.dispatchStatus) ?? [], [detail]);

  React.useEffect(() => {
    if (!activeDept && dispatchableSections.length > 0) {
      setActiveDept(dispatchableSections[0]!.departmentTag);
    }
  }, [activeDept, dispatchableSections]);

  if (status === 'loading' || !detail) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <DispatchFulfilSkeletonMobile />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <MobileErrorState title="Couldn't load this requisition" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  const section = detail.sections.find((s) => s.departmentTag === activeDept) ?? dispatchableSections[0] ?? null;
  const lines = section ? (visibleLinesBySection[section.departmentTag] ?? section.lines) : [];
  const fullCount = lines.filter((l) => l.requestedQty === null || Number(l.dispatchQty) >= Number(l.requestedQty)).length;
  const shortCount = lines.length - fullCount;
  const shortLines = lines.filter((l) => l.requestedQty !== null && Number(l.dispatchQty) < Number(l.requestedQty));

  const handleSign = async (pin: string) => {
    if (!section) return;
    const ok = await dispatchSection(section.departmentTag, pin);
    if (ok) {
      setSignOpen(false);
      const remaining = detail.sections.filter((s) => !s.dispatchStatus && s.departmentTag !== section.departmentTag);
      if (remaining.length > 0) {
        setActiveDept(remaining[0]!.departmentTag);
      } else {
        router.push('/app/inventory/dispatch');
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-wds-canvas">
      <MobileStatusBar />
      <div className="flex flex-col gap-2 bg-wds-sidebar-top px-wds-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/app/inventory/dispatch')} aria-label="Back" className="shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M15 18l-6-6 6-6" fill="none" stroke="#F5F3EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex grow flex-col gap-0.5">
            <div className="font-wds-sans text-[17px]/[22px] font-semibold text-white">
              Fulfil {section ? DEPARTMENT_LABEL[section.departmentTag] : ''} · {detail.branchName}
            </div>
            <div className="font-wds-sans text-wds-caption text-[#B5AEA5]">Enter what you&apos;re actually sending · partial is normal</div>
          </div>
          <button type="button" onClick={() => router.push('/app/inventory/dispatch')} className="shrink-0 font-wds-sans text-wds-body-sm text-[#B5AEA5]">
            Cancel
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {detail.sections.map((s) => {
            const isActive = section?.departmentTag === s.departmentTag;
            const isDone = Boolean(s.dispatchStatus);
            return (
              <button
                key={s.departmentTag}
                type="button"
                onClick={() => setActiveDept(s.departmentTag)}
                className={
                  'flex shrink-0 items-center gap-[5px] rounded-wds-sm px-3 py-1.5 ' +
                  (isActive ? 'bg-wds-primary' : 'border border-wds-border')
                }
              >
                {isDone && !isActive ? (
                  <StatusDot tone="success" className="gap-0">
                    <span className="sr-only">Dispatched</span>
                  </StatusDot>
                ) : null}
                <span className={'font-wds-sans text-wds-caption ' + (isActive ? 'font-semibold text-white' : 'text-wds-text-copy-muted')}>
                  {DEPARTMENT_LABEL[s.departmentTag]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {section ? (
        <>
          <div className="flex flex-col gap-3 px-wds-4 py-[18px]">
            {dispatchError ? (
              <div className="rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5">
                <div className="font-wds-sans text-wds-caption text-wds-error-fg">{dispatchError}</div>
              </div>
            ) : null}
            {lines.map((line) => (
              <StepperLineCard key={line.inventoryItemId} line={line} onChange={(v) => setLineEdit(line.inventoryItemId, { dispatchQty: v })} />
            ))}
            <button type="button" className="px-1 py-[11px] text-left font-wds-sans text-wds-body-sm text-wds-primary">
              + Add substitute line
            </button>
            {shortLines.length > 0 ? (
              <div className="flex gap-[9px] py-3">
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
                <div className="font-wds-sans text-wds-caption leading-[17px] text-wds-warning-fg">
                  {shortLines.length} line{shortLines.length === 1 ? '' : 's'} short —{' '}
                  {shortLines.map((l) => `${l.itemName}: ${l.dispatchQty} of ${l.requestedQty}`).join(', ')}. Not an error; the shortfall carries to{' '}
                  {detail.branchName}&apos;s next requisition automatically.
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-wds-border bg-wds-surface px-wds-4 pb-5 pt-3.5">
            <div className="font-wds-mono text-wds-label text-wds-text-copy-muted">
              {lines.length} line{lines.length === 1 ? '' : 's'} · {fullCount} full{shortCount > 0 ? ` · ${shortCount} short` : ''}
            </div>
            <button
              type="button"
              onClick={() => setSignOpen(true)}
              disabled={dispatchingSection !== null}
              className="flex items-center justify-center rounded-wds-sm bg-wds-gradient-primary p-3.5 shadow-wds-sheen disabled:opacity-60"
            >
              <span className="font-wds-sans text-section font-medium text-white">Confirm &amp; sign dispatch</span>
            </button>
            <div className="text-center font-wds-sans text-wds-label text-wds-text-copy-muted">
              Signing moves stock out · department goes In Transit until {DEPARTMENT_LABEL[section.departmentTag]} confirms.
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <div className="text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Every department has been dispatched.</div>
        </div>
      )}

      <SignSheetDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sign this dispatch"
        subtitle={section ? `${DEPARTMENT_LABEL[section.departmentTag]} · ${detail.branchName} — ${lines.length} lines${shortCount > 0 ? `, ${shortCount} short` : ''}. Enter your PIN to commit.` : ''}
        helperText="Signing moves stock out of the Central Store."
        confirmLabel="Sign & dispatch"
        onSubmit={handleSign}
        submitting={dispatchingSection !== null}
        error={dispatchError ?? undefined}
      />
    </div>
  );
}
