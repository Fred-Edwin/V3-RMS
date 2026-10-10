'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { roleLabel } from '@/components/app/shell/role-label';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { DrawerShell } from '../../../_shared/components/drawer-shell';
import { ChoiceChips } from '../../../_shared/components/decision-dialog';
import { PinField, RefLink } from '../../../_shared/components/block2-phone-parts';
import { useAction } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_ERROR_COPY, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import {
  CORRECTION_NOTE_MAX,
  CORRECTION_REASONS,
  CORRECTION_REASON_TEXT,
  type BranchDayErrorCode,
  type CorrectCountResult,
  type CorrectionReason,
  type DepartmentFigures,
  type FigureLine,
} from '../../_shared/types/branch-day-contract';
import { kes, qty } from '../lib/desk-format';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { MonoLabel, PRESS, PRIMARY_LINK } from './day-parts';

type Dept = DepartmentFigures['department'];
export interface CorrectionTarget {
  departmentId: string;
  departmentName: string;
  line: FigureLine;
}

const isCode = (code: string | null): code is BranchDayErrorCode => code !== null && code in BRANCH_DAY_ERROR_COPY;
const num = (value: string | null | undefined): number => (value === null || value === undefined ? 0 : Number(value));
/** A typed figure: a non-negative number, or null while it is empty or not a number. */
const parseFigure = (text: string): number | null => {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^\d*\.?\d+$/.test(t)) return null;
  return Number(t);
};
const unitWord = (unit: string): string => unit.toLowerCase();

/**
 * Paper B12: Correct a count. One item on a closed day, chosen with "Change" (a searchable list of the day's items, gap G14), the closing
 * figure it was and should be, a WHAT CHANGES table that follows the typed figure, one reason (Other needs a note, G15), an optional note of
 * 200 characters, the Branch Manager's own PIN. Posts one linked ledger entry; the original close stays. The idempotency key is made when the
 * drawer opens. Errors say what happened in the copy table's words and keep what was typed.
 */
export function CorrectCountDrawer({ dayId, reference, referenceHref, rail, initial, open, onOpenChange, onCorrected, onStale }: {
  dayId: string;
  reference: string;
  referenceHref: string;
  /** The day's departments (id and name); their items load when "Change" opens. */
  rail: readonly { departmentId: string; name: string }[];
  /** The item the drawer opens on. */
  initial: CorrectionTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrected: (result: CorrectCountResult) => void;
  /** The window passed or the day changed under the drawer: the screen reloads the file. */
  onStale: (message: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const idem = useIdempotencyKey();
  const [target, setTarget] = React.useState<CorrectionTarget | null>(initial);
  const [figure, setFigure] = React.useState('');
  const [reason, setReason] = React.useState<CorrectionReason | null>(null);
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);

  const renewKey = idem.renew;
  React.useEffect(() => {
    if (open) {
      setTarget(initial);
      setFigure('');
      setReason(null);
      setNote('');
      setPin('');
      setPinError(null);
      setFormError(null);
      setPicking(false);
      renewKey();
    }
    // The drawer starts fresh each time it opens; `initial` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renewKey]);

  const post = useAction(
    (input: { departmentId: string; itemId: string; closingQty: string; reason: CorrectionReason; note?: string; pin: string }) => branchDayDeskApi.correct(dayId, { ...input, idempotencyKey: idem.key() }),
    BRANCH_DAY_STATES_COPY.correct.error,
  );

  const line = target?.line ?? null;
  const next = parseFigure(figure);
  const was = num(line?.closingQty);
  const changed = next !== null && line !== null && next !== was;
  const needsNote = reason === 'OTHER';
  const noteOk = !needsNote || note.trim().length > 0;
  const ready = Boolean(target) && changed && reason !== null && noteOk && pin.length === 4 && !post.saving;

  const submit = async (): Promise<void> => {
    if (!ready || !target || next === null || reason === null) return;
    setFormError(null);
    setPinError(null);
    const result = await post.run({ departmentId: target.departmentId, itemId: target.line.itemId, closingQty: String(next), reason, ...(note.trim() ? { note: note.trim() } : {}), pin });
    if (result) onCorrected(result);
  };

  React.useEffect(() => {
    const failure = post.failure;
    if (!failure) return;
    const code = isCode(failure.code) ? failure.code : null;
    if (code === 'INVALID_PIN') {
      setPin('');
      setPinError(BRANCH_DAY_ERROR_COPY.INVALID_PIN);
    } else if (code === 'CORRECTION_WINDOW_PASSED' || code === 'DAY_NOT_CLOSED' || code === 'DEPARTMENT_NOT_COUNTED') {
      onStale(BRANCH_DAY_ERROR_COPY[code]);
    } else if (code === 'CORRECTION_NO_CHANGE' || code === 'ITEM_NOT_IN_DAY') {
      setFormError(BRANCH_DAY_ERROR_COPY[code]);
    } else {
      setFormError(BRANCH_DAY_STATES_COPY.correct.error);
    }
    // onStale is a stable callback from the screen; the effect reacts to a new failure only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.failure]);

  // WHAT CHANGES: the same arithmetic as the server (used = opening + received − waste − closing), with the typed figure.
  const unitCost = line?.unitCostKes !== undefined ? num(line.unitCostKes) : null;
  const usedWas = num(line?.usedQty);
  const usedNew = line && next !== null ? num(line.openingQty) + num(line.receivedQty) - num(line.wasteQty) - next : usedWas;
  const closingNew = next ?? was;
  const rows: { label: string; from: string; to: string }[] = line
    ? [
        { label: 'Used today', from: qty(String(usedWas)), to: qty(String(usedNew)) },
        ...(unitCost !== null
          ? [
              { label: 'Used value (KES)', from: kes(String(usedWas * unitCost)), to: kes(String(usedNew * unitCost)) },
              { label: 'Closing stock value (KES)', from: kes(String(was * unitCost)), to: kes(String(closingNew * unitCost)) },
            ]
          : []),
      ]
    : [];

  return (
    <DrawerShell
      variant="day"
      open={open}
      onOpenChange={(value) => {
        if (!post.saving) onOpenChange(value);
      }}
      title={BRANCH_DAY_BUTTONS.correctCount}
      description={
        <>
          One item on the closed day · <RefLink reference={reference} href={referenceHref} className="text-[13px]" />
        </>
      }
      primaryLabel={post.saving ? 'Posting the correction' : BRANCH_DAY_BUTTONS.postCorrection}
      onPrimaryAction={() => void submit()}
      primaryDisabled={!ready}
      initialFocus="#correct-new"
      escapeGuard={() => picking}
    >
      <div className="flex flex-col gap-[18px]" aria-busy={post.saving}>
        <div className="flex flex-col gap-1.5">
          <MonoLabel id="correct-item-label">Item</MonoLabel>
          {picking ? (
            <ItemPicker
              dayId={dayId}
              rail={rail}
              onPick={(t) => {
                setTarget(t);
                setFigure('');
                setPicking(false);
                setFormError(null);
              }}
              onCancel={() => setPicking(false)}
            />
          ) : (
            <div aria-labelledby="correct-item-label" className="flex h-11 items-center justify-between gap-3 border border-wds-selected-edge bg-wds-caramel-100 px-3.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line?.itemName ?? '–'}</span>
                {line ? <span className="truncate font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{target?.departmentName} · {unitWord(line.unit)}</span> : null}
              </span>
              <button type="button" onClick={() => setPicking(true)} disabled={post.saving} className={cn(PRIMARY_LINK, 'text-[13px] leading-4')}>
                Change<span className="sr-only"> item</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div className="flex min-w-0 grow basis-0 flex-col gap-1">
            <MonoLabel id="correct-was-label">Closing stock was</MonoLabel>
            <div aria-labelledby="correct-was-label" className="flex h-11 items-center border border-wds-border bg-wds-neutral-50 px-3.5 font-wds-mono text-[18px] leading-[22px] text-wds-text-ink">{line ? qty(line.closingQty) : '–'}</div>
          </div>
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="#847E76" strokeWidth="1.5" aria-hidden="true" className="mb-[14px] shrink-0">
            <path d="M0 8H17M11 2L17 8L11 14" />
          </svg>
          <div className="flex min-w-0 grow basis-0 flex-col gap-1">
            <label htmlFor="correct-new" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Closing stock should be</label>
            <input
              id="correct-new"
              inputMode="decimal"
              autoComplete="off"
              value={figure}
              disabled={post.saving || !line}
              onChange={(e) => {
                setFigure(e.target.value);
                setFormError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
              aria-invalid={figure !== '' && next === null ? true : undefined}
              className="h-11 w-full border border-wds-border-strong bg-white px-3.5 font-wds-mono text-[18px] leading-[22px] text-wds-text-ink outline-none transition-shadow duration-100 focus:border-wds-selected-edge focus:shadow-[0_0_0_3px_var(--wds-caramel-100)] aria-[invalid=true]:border-wds-error-fg"
            />
          </div>
        </div>

        <section aria-label="What changes" aria-live="polite" className="border-t-2 border-wds-text-ink">
          <div className="px-3.5 pb-1 pt-2.5"><MonoLabel>What changes</MonoLabel></div>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 border-t border-wds-border px-3.5 py-[7px] first:border-t-0 last:pb-2.5">
              <span className="grow font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.label}</span>
              <span className="font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{r.from}</span>
              <span aria-hidden="true" className="font-sans text-[12px] leading-4 text-[#8D8982]">→</span>
              <span className={cn('w-[60px] text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink', changed && 'font-semibold')}>{r.to}</span>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-1.5">
          <MonoLabel id="correct-why">Why · required</MonoLabel>
          <div aria-labelledby="correct-why">
            <ChoiceChips name="correction-reason" label="Why" options={CORRECTION_REASONS} value={reason} onChange={setReason} tone="ink" size="drawer" labelOf={(r) => CORRECTION_REASON_TEXT[r]} disabled={post.saving} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="correct-note" className="flex items-baseline justify-between font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
            <span>{needsNote ? 'Note · required' : 'Note · optional'}</span>
            <span className="normal-case tracking-normal">{note.length}/{CORRECTION_NOTE_MAX}</span>
          </label>
          <textarea
            id="correct-note"
            value={note}
            maxLength={CORRECTION_NOTE_MAX}
            disabled={post.saving}
            onChange={(e) => setNote(e.target.value)}
            aria-required={needsNote}
            className="h-14 w-full resize-none border border-wds-border-strong bg-white px-3 py-2.5 font-wds-sans text-[14px] leading-5 text-wds-text-ink outline-none transition-shadow duration-100 placeholder:text-[#8D8982] focus:border-wds-selected-edge focus:shadow-[0_0_0_3px_var(--wds-caramel-100)]"
            placeholder="A bag was in the dry store, not on the shelf."
          />
        </div>

        <p className="m-0 border border-wds-info-border bg-wds-info-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-info-fg">{BRANCH_DAY_MESSAGES.correctionPosts}</p>

        <div className="flex items-start gap-2.5">
          <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
            <MonoLabel id="correct-signed-by">Signed by</MonoLabel>
            <div aria-labelledby="correct-signed-by" className="flex h-11 items-center border border-wds-border bg-wds-neutral-50 px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{roleLabel(user?.role)}</div>
          </div>
          <div className="min-w-0 grow basis-0">
            <PinField id="correct-pin" size="paper" value={pin} onChange={(v) => { setPin(v); if (pinError) setPinError(null); }} onSubmit={() => void submit()} error={pinError} disabled={post.saving} />
          </div>
        </div>

        {formError ? (
          <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{formError}</p>
        ) : null}
      </div>
    </DrawerShell>
  );
}

/** Gap G14: a searchable list of the day's items, grouped by department, in place of the chosen-item bar. */
function ItemPicker({ dayId, rail, onPick, onCancel }: { dayId: string; rail: readonly { departmentId: string; name: string }[]; onPick: (target: CorrectionTarget) => void; onCancel: () => void }) {
  const [groups, setGroups] = React.useState<{ departmentId: string; name: string; lines: FigureLine[] }[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const dayRef = React.useRef(rail);

  React.useEffect(() => {
    let live = true;
    // The picker reads every department's lines once; the day id is carried by the figures call.
    const first = dayRef.current[0];
    if (!first) return;
    void (async () => {
      try {
        const figures = await Promise.all(dayRef.current.map((d) => branchDayDeskApi.figures(dayId, d.departmentId)));
        if (live) setGroups(figures.map((f) => ({ departmentId: f.department.id, name: f.department.name, lines: f.department.lines })));
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const q = term.trim().toLowerCase();
  return (
    <div className="flex flex-col border border-wds-selected-edge bg-white">
      <input
        autoFocus
        type="search"
        aria-label="Find an item"
        placeholder="Find an item"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="h-11 w-full border-0 border-b border-wds-border bg-transparent px-3.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-[#8D8982]"
      />
      <div className="max-h-[260px] overflow-y-auto" role="listbox" aria-label="Items on this day">
        {failed ? (
          <p className="m-0 px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">Could not load the items. Cancel and try again.</p>
        ) : !groups ? (
          <div className="flex flex-col gap-2 p-3.5" aria-hidden="true">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : (
          groups.map((g) => {
            const lines = g.lines.filter((l) => l.closingQty !== null && (q === '' || l.itemName.toLowerCase().includes(q)));
            if (lines.length === 0) return null;
            return (
              <div key={g.departmentId} role="group" aria-label={g.name}>
                <div className="px-3.5 pb-1 pt-2.5"><MonoLabel>{g.name}</MonoLabel></div>
                {lines.map((l) => (
                  <button
                    key={l.itemId}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onPick({ departmentId: g.departmentId, departmentName: g.name, line: l })}
                    className={cn(PRESS, 'flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)] [@media(hover:hover)]:hover:bg-wds-neutral-50')}
                  >
                    <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{l.itemName}</span>
                    <span className="font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{qty(l.closingQty)} {unitWord(l.unit)}</span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
      <div className="flex justify-end border-t border-wds-border px-3.5 py-2">
        <button type="button" onClick={onCancel} className={PRIMARY_LINK}>Keep this item</button>
      </div>
    </div>
  );
}
