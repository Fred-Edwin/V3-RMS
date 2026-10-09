'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { block2ErrorMessage, couldNotLoad, detailIds, errorCodeOf, OFFLINE_PACK_MESSAGE } from '../../../_shared/lib/block2-words';
import { useRestoreFocus } from '../../../requisitions/hooks/use-restore-focus';
import { formatQty, toNumber } from '../../../requisitions/lib/qty';
import { usePackDepartment } from '../../hooks/use-phone-dispatch';
import { askedLine, clampSend, groupByCategory, maxSend, stepFor, ticked, withEdits, type EffectiveLine, type PackLineEdit } from '../../lib/pack-logic';
import { DISPATCH_HOME, packDepartment as packDepartmentRoute, packOverview } from '../../lib/phone-routes';
import { dispatchPhoneApi } from '../../services/dispatch-phone-api';

const SAVE_DELAY_MS = 500;

/** Pack one department (Paper D2) and the short-a-line sheet (D3). One tap per line; nothing is signed and no stock moves yet. */
export function PackDepartmentScreen({ requisitionId, departmentId }: { requisitionId: string; departmentId: string }) {
  const router = useRouter();
  const pack = usePackDepartment(requisitionId, departmentId);
  const data = pack.data;

  const [edits, setEdits] = React.useState<Record<string, PackLineEdit>>({});
  const [flagged, setFlagged] = React.useState<ReadonlySet<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [changedNotice, setChangedNotice] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [sheetId, setSheetId] = React.useState<string | null>(null);

  // What the server last told us the lines asked for: a change under the packer shows "This list changed."
  const baseline = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!data) return;
    const signature = data.lines.map((l) => `${l.lineId}:${l.requestedQty}`).join('|');
    if (baseline.current !== null && baseline.current !== signature) setChangedNotice(true);
    baseline.current = signature;
  }, [data]);

  const lines: EffectiveLine[] = React.useMemo(() => (data ? withEdits(data.lines, edits) : []), [data, edits]);
  const latest = React.useRef(lines);
  React.useEffect(() => {
    latest.current = lines;
  });

  // --- Saving: every change is saved a moment later (last write wins); "Done with" waits for it. ---
  const timer = React.useRef<number | undefined>(undefined);
  const inflight = React.useRef<Promise<boolean> | null>(null);
  const dirty = React.useRef(false);

  const save = React.useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (!dirty.current) return inflight.current ? inflight.current : true;
    dirty.current = false;
    const run = (async (): Promise<boolean> => {
      try {
        const updated = await dispatchPhoneApi.saveLines(requisitionId, departmentId, {
          lines: latest.current.map((l) => ({ lineId: l.lineId, sentQty: l.sentQty, packedTick: l.packedTick })),
        });
        setFlagged(new Set());
        setError(null);
        pack.setData(updated);
        return true;
      } catch (err) {
        dirty.current = true;
        if (errorCodeOf(err) === 'STOCK_CHANGED') setFlagged(new Set(detailIds(err, 'lineIds')));
        setError(block2ErrorMessage(err, { offline: OFFLINE_PACK_MESSAGE }));
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    if (inflight.current === run) inflight.current = null;
    return ok;
  }, [requisitionId, departmentId, pack]);

  const queueSave = React.useCallback(() => {
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [save]);

  // A packer who leaves with a change still waiting must not lose it. Runs on unmount only (a render must never send a save), and
  // reads the newest `save` and lines through refs so it never sends what the screen showed a moment ago.
  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  });
  React.useEffect(
    () => () => {
      if (dirty.current) void saveRef.current();
    },
    [],
  );

  const edit = (line: EffectiveLine, patch: Partial<PackLineEdit>): void => {
    setEdits((prev) => ({ ...prev, [line.lineId]: { sentQty: patch.sentQty ?? line.sentQty, packedTick: patch.packedTick ?? line.packedTick } }));
    setFlagged((prev) => {
      if (!prev.has(line.lineId)) return prev;
      const next = new Set(prev);
      next.delete(line.lineId);
      return next;
    });
    queueSave();
  };

  const toggle = (line: EffectiveLine): void => {
    // A line the store cannot fill in full needs a decision before it ticks: the sheet asks how many to send.
    if (!line.packedTick && line.notEnough && !edits[line.lineId]) {
      setSheetId(line.lineId);
      return;
    }
    edit(line, { packedTick: !line.packedTick });
  };

  const total = lines.length;
  const done = ticked(lines);
  const left = total - done;
  const sheetLine = lines.find((l) => l.lineId === sheetId) ?? null;

  const finish = async (): Promise<void> => {
    if (!data) return;
    setLeaving(true);
    const ok = await save();
    setLeaving(false);
    if (!ok) return;
    router.push(data.nextDepartmentId && !data.allPacked ? packDepartmentRoute(requisitionId, data.nextDepartmentId) : packOverview(requisitionId));
  };

  const back = (): void => {
    void save();
    router.push(DISPATCH_HOME);
  };

  if (pack.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Pack" subtitle="" leading="back" onBack={() => router.push(DISPATCH_HOME)} place="CENTRAL STORE" />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load this department" description={couldNotLoad('this department')} onRetry={() => void pack.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) return <PackSkeleton onBack={() => router.push(DISPATCH_HOME)} />;

  const groups = groupByCategory(lines);
  return (
    <PhoneColumn>
      <B2Header
        title={`${data.department.name} · ${data.branch.name}`}
        subtitle={`Department ${data.position.index} of ${data.position.total} · ${data.reference} · ${total} ${total === 1 ? 'line' : 'lines'}`}
        mono
        leading="back"
        onBack={back}
        place="CENTRAL STORE"
      />
      <div className="flex shrink-0 flex-col gap-2 border-b border-wds-text-ink bg-wds-surface px-5 pb-3 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink" aria-live="polite">
            {done} of {total} packed
          </p>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Tap a number to change it</p>
        </div>
        <div className="h-1 w-full bg-wds-neutral-100" role="progressbar" aria-label="Lines packed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-1 bg-wds-success-fg transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        {changedNotice ? (
          <div className="px-5 pt-3" role="status">
            <p className="border border-wds-info-border bg-wds-info-bg px-3.5 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-info-fg">This list changed. The new quantities show.</p>
          </div>
        ) : null}
        {error ? (
          <div className="px-5 pt-3">
            <B2ErrorNote>{error}</B2ErrorNote>
          </div>
        ) : null}
        {groups.map((group) => (
          <section key={group.heading} aria-label={group.heading}>
            <div className="px-5 pb-1.5 pt-3">
              <SectionLabel>{group.heading}</SectionLabel>
            </div>
            <ul>
              {group.lines.map((line) => (
                <LineRow key={line.lineId} line={line} flagged={flagged.has(line.lineId)} onToggle={() => toggle(line)} onChange={() => setSheetId(line.lineId)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <B2Footer note={left > 0 ? `${left} ${left === 1 ? 'line' : 'lines'} left to tick before you go on.` : undefined}>
        <B2PrimaryButton disabled={left > 0 || leaving} onClick={() => void finish()}>
          {leaving ? 'Saving…' : `Done with ${data.department.name}`}
        </B2PrimaryButton>
      </B2Footer>
      <SendSheet
        line={sheetLine}
        departmentName={data.department.name}
        onClose={() => setSheetId(null)}
        onSend={(line, qty) => {
          edit(line, { sentQty: qty, packedTick: true });
          setSheetId(null);
        }}
      />
    </PhoneColumn>
  );
}

function LineRow({ line, flagged, onToggle, onChange }: { line: EffectiveLine; flagged: boolean; onToggle: () => void; onChange: () => void }) {
  const amber = flagged || (line.notEnough && !line.packedTick);
  return (
    <li className={cn('flex items-center gap-3 border-b border-wds-border px-5 py-[9px]', amber ? 'bg-wds-warning-bg' : 'bg-wds-surface')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={line.packedTick}
        aria-label={`${line.itemName}, packed`}
        onClick={onToggle}
        className="-m-3 flex size-[46px] shrink-0 items-center justify-center outline-none focus-visible:[&>span]:shadow-wds-ring"
      >
        <span className={cn('flex size-[22px] items-center justify-center', line.packedTick ? 'bg-wds-success-fg' : 'border-[1.5px] border-wds-border-strong bg-white')}>
          {line.packedTick ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 6.5L5 9.5L10 3" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
            </svg>
          ) : null}
        </span>
      </button>
      <div className="flex min-w-0 grow basis-0 flex-col gap-px">
        <p className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{line.itemName}</p>
        <p className={cn('font-wds-sans text-[13px] leading-[18px]', amber ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{askedLine(line, line.notEnough)}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-label={`Change the quantity of ${line.itemName}, now ${formatQty(line.sentQty)}`}
        // Paper draws the box 36 px tall (rows are 58 px); the touch target stays 44 px through the transparent extension above and below.
        className="relative flex h-9 w-14 shrink-0 items-center justify-center border border-wds-border-strong bg-white font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink outline-none transition-colors duration-100 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
      >
        {formatQty(line.sentQty)}
      </button>
    </li>
  );
}

// --- D3: the short-a-line sheet ------------------------------------------------------------------------------------------------------

function SendSheet({ line, departmentName, onClose, onSend }: { line: EffectiveLine | null; departmentName: string; onClose: () => void; onSend: (line: EffectiveLine, qty: string) => void }) {
  const open = line !== null;
  useRestoreFocus(open);
  const [draft, setDraft] = React.useState('');
  const keyRef = React.useRef<string | null>(null);
  if (line && keyRef.current !== line.lineId) {
    keyRef.current = line.lineId;
    setDraft(formatQty(line.sentQty));
  }
  if (!line && keyRef.current !== null) keyRef.current = null;

  const sheetBody = (l: EffectiveLine): React.ReactNode => {
    const max = maxSend(l);
    const value = Math.min(max, Math.max(0, toNumber(draft)));
    const step = stepFor(l.requestedQty);
    const sent = formatQty(value);
    const asked = formatQty(l.requestedQty);
    const short = value < toNumber(l.requestedQty);
    // Paper D3: three separate 44 px cells (a 64 px number between two 44 px steppers), each with its own 1 px border.
    const btn = 'relative flex h-11 w-11 shrink-0 items-center justify-center border border-wds-border-strong bg-transparent text-wds-text-ink outline-none transition-colors focus-visible:z-10 focus-visible:shadow-wds-ring enabled:hover:bg-wds-neutral-100 active:bg-wds-neutral-100 disabled:text-wds-text-faint';
    return (
      <div className="flex flex-col gap-[18px] px-5 pb-6 pt-3">
        <SheetGrabber />
        <div className="flex flex-col gap-1">
          <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">{l.itemName}</h2>
          <p className={cn('font-wds-sans text-[14px] leading-5', l.notEnough ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
            {l.notEnough ? `Asked ${asked} · only ${formatQty(l.onHand)} in store` : `Asked ${asked} · In store ${formatQty(l.onHand)}`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border border-wds-text-ink px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">You send</span>
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">of {asked} asked</span>
          </div>
          <div role="group" aria-label={`Quantity to send of ${l.itemName}`} className="flex items-center bg-wds-surface">
            <button type="button" className={btn} aria-label="Send less" disabled={value <= 0} onClick={() => setDraft(clampSend(l, value - step))}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 7H12" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            <input
              value={draft}
              inputMode="decimal"
              aria-label={`${l.itemName} quantity to send`}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() => setDraft(clampSend(l, toNumber(draft)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSend(l, clampSend(l, toNumber(draft)));
                }
              }}
              className="h-11 w-16 border-y border-wds-border-strong bg-transparent text-center font-wds-sans text-[20px] font-semibold leading-6 text-wds-text-ink outline-none focus-visible:shadow-wds-ring"
            />
            <button type="button" className={btn} aria-label="Send more" disabled={value >= max} onClick={() => setDraft(clampSend(l, value + step))}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 7H12M7 2V12" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        </div>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {departmentName} will see {asked} asked and {sent} sent.{short ? ' A short line is normal: it is not carried over, and the next requisition suggests it again.' : ''}
        </p>
        <B2PrimaryButton onClick={() => onSend(l, clampSend(l, toNumber(draft)))}>{value === 0 ? 'Send none and tick the line' : `Send ${sent}${short ? ` of ${asked}` : ''} and tick the line`}</B2PrimaryButton>
      </div>
    );
  };

  return (
    <BottomSheet open={open} onOpenChange={(next) => (next ? undefined : onClose())} label={line ? `How many ${line.itemName} to send` : 'Quantity'} scrim={45}>
      {line ? sheetBody(line) : null}
    </BottomSheet>
  );
}

function PackSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <PhoneColumn>
      <B2Header title="Pack" subtitle="" leading="back" onBack={onBack} place="CENTRAL STORE" />
      <LoadingAnnouncer text="Loading this department" />
      <div className="flex flex-1 flex-col bg-wds-canvas" aria-hidden="true">
        <div className="border-b border-wds-text-ink bg-wds-surface px-5 py-3.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-1 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-wds-border bg-wds-surface px-5 py-[9px]">
            <Skeleton className="size-[22px]" />
            <div className="flex grow flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <Skeleton className="h-11 w-14" />
          </div>
        ))}
      </div>
    </PhoneColumn>
  );
}
