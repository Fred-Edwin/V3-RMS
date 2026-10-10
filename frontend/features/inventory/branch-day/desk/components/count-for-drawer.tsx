'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { roleLabel } from '@/components/app/shell/role-label';
import { useAuthStore } from '@/store/authStore';
import { ErrorState } from '@/components/app/shell/shell-states';
import { DrawerShell } from '../../../_shared/components/drawer-shell';
import { Chip, PinField } from '../../../_shared/components/block2-phone-parts';
import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_ERROR_COPY, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { BranchDayErrorCode, SignCountResult } from '../../_shared/types/branch-day-contract';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { itemsText } from '../lib/desk-format';
import { MonoLabel, PRIMARY_LINK } from './day-parts';

const isCode = (code: string | null): code is BranchDayErrorCode => code !== null && code in BRANCH_DAY_ERROR_COPY;
const isFigure = (text: string): boolean => /^\d+(\.\d{1,4})?$/.test(text.trim());

type Step = 'count' | 'sign';

/**
 * Paper B15: the Branch Manager counts a department that has not counted (a blind count, nothing to count against), recorded "on behalf of
 * the department" and signed with the Branch Manager's own PIN. Gap G23: "Check and sign" shows the receipt and the PIN in the same drawer.
 * Typed figures are saved when a box loses focus and before the sign step, so nothing is lost if the drawer closes.
 */
export function CountForDrawer({ department, open, onOpenChange, onSigned }: {
  department: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSigned: (result: SignCountResult, department: { id: string; name: string }) => void;
}) {
  const departmentId = department?.id ?? null;
  const view = useLoader(open && departmentId ? `count:${departmentId}` : null, () => branchDayDeskApi.count(departmentId ?? ''), BRANCH_DAY_STATES_COPY.count.error);
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = React.useState<Step>('count');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState<Record<string, string>>({});
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const boxes = React.useRef<Record<string, HTMLInputElement | null>>({});
  const idem = useIdempotencyKey();
  const seeded = React.useRef<string | null>(null);

  // A fresh walk each time the drawer opens; the typed figures come back from the server (a figure saved earlier is kept).
  const renewKey = idem.renew;
  React.useEffect(() => {
    if (open) {
      setStep('count');
      setPin('');
      setPinError(null);
      setSaveError(null);
      setValues({});
      setSaved({});
      seeded.current = null;
      renewKey();
    }
  }, [open, renewKey]);

  React.useEffect(() => {
    const data = view.data;
    if (!data || seeded.current === data.department.id) return;
    seeded.current = data.department.id;
    const start: Record<string, string> = {};
    for (const l of data.lines) if (l.countedQty !== null) start[l.itemId] = l.countedQty;
    setValues(start);
    setSaved(start);
  }, [view.data]);

  // The items arrive after the drawer opens: focus goes to the first box then, so counting can start with the keyboard.
  const loaded = view.data !== null;
  React.useEffect(() => {
    if (!open || !loaded) return;
    if (step === 'count') document.querySelector<HTMLElement>('[data-first-count]')?.focus();
    else document.getElementById('count-pin')?.focus();
  }, [open, loaded, step]);

  const lines = view.data?.lines ?? [];
  const filled = lines.filter((l) => isFigure(values[l.itemId] ?? '')).length;
  const remaining = lines.length - filled;

  const save = useAction(
    (changes: { itemId: string; countedQty: string | null }[]) => branchDayDeskApi.saveCount(departmentId ?? '', { lines: changes }),
    BRANCH_DAY_STATES_COPY.count.error,
  );
  const sign = useAction((code: string) => branchDayDeskApi.signCount(departmentId ?? '', { pin: code, idempotencyKey: idem.key() }), BRANCH_DAY_STATES_COPY.close.error);

  const flush = async (): Promise<boolean> => {
    const changes = lines
      .map((l) => ({ itemId: l.itemId, countedQty: isFigure(values[l.itemId] ?? '') ? (values[l.itemId] ?? '').trim() : null }))
      .filter((c) => (saved[c.itemId] ?? null) !== c.countedQty);
    if (changes.length === 0) return true;
    const result = await save.run(changes);
    if (!result) {
      setSaveError(BRANCH_DAY_STATES_COPY.count.error);
      return false;
    }
    setSaveError(null);
    setSaved((prev) => {
      const next = { ...prev };
      for (const c of changes) {
        if (c.countedQty === null) delete next[c.itemId];
        else next[c.itemId] = c.countedQty;
      }
      return next;
    });
    return true;
  };

  const toSign = async (): Promise<void> => {
    if (remaining > 0) return;
    if (await flush()) setStep('sign');
  };

  const submit = async (): Promise<void> => {
    if (pin.length !== 4 || sign.saving || !department) return;
    const result = await sign.run(pin);
    if (result) onSigned(result, department);
  };

  React.useEffect(() => {
    const failure = sign.failure;
    if (!failure) return;
    const code = isCode(failure.code) ? failure.code : null;
    if (code === 'INVALID_PIN') {
      setPin('');
      setPinError(BRANCH_DAY_ERROR_COPY.INVALID_PIN);
    } else if (code === 'COUNT_INCOMPLETE') {
      setStep('count');
      setSaveError(BRANCH_DAY_ERROR_COPY.COUNT_INCOMPLETE);
    } else if (code === 'ALREADY_COUNTED') {
      setPinError(BRANCH_DAY_ERROR_COPY.ALREADY_COUNTED);
    } else {
      setPinError(failure.message);
    }
  }, [sign.failure]);

  const name = department?.name ?? '';
  const nextBox = (from: number): void => {
    for (let i = from + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (line && !isFigure(values[line.itemId] ?? '')) {
        boxes.current[line.itemId]?.focus();
        return;
      }
    }
  };

  const countStep = (
    <>
      <p className="m-0 border border-wds-info-border bg-wds-info-bg px-3.5 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-info-fg">{BRANCH_DAY_MESSAGES.onBehalf(name)}</p>
      {view.status === 'error' ? (
        <ErrorState title="Could not load the items" description={BRANCH_DAY_STATES_COPY.count.error} onRetry={view.reload} className="my-4" />
      ) : !view.data ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_STATES_COPY.count.empty}</p>
      ) : (
        <div>
          <ul className="m-0 list-none border-t-2 border-wds-text-ink p-0" aria-label={`${name} items to count`}>
            {lines.map((l, i) => {
              const text = values[l.itemId] ?? '';
              const bad = text !== '' && !isFigure(text);
              return (
                <li key={l.itemId} className="flex items-center gap-3 border-b border-wds-border py-2.5">
                  <label htmlFor={`count-${l.itemId}`} className="grow font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
                    {l.itemName}
                    <span className="sr-only">, in {l.unit.toLowerCase()}</span>
                  </label>
                  <input
                    id={`count-${l.itemId}`}
                    ref={(node) => {
                      boxes.current[l.itemId] = node;
                    }}
                    data-first-count={i === 0 ? '' : undefined}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="–"
                    value={text}
                    aria-invalid={bad ? true : undefined}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [l.itemId]: e.target.value.replace(/[^\d.]/g, '') }));
                      setSaveError(null);
                    }}
                    onBlur={() => void flush()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nextBox(i);
                      }
                    }}
                    className={cn(
                      'h-9 w-16 shrink-0 border bg-white text-center font-wds-mono text-[16px] leading-5 text-wds-text-ink outline-none transition-shadow duration-100 placeholder:font-wds-sans placeholder:text-[#8D8982]',
                      bad ? 'border-wds-error-fg' : 'border-wds-border-strong focus:border-wds-selected-edge focus:shadow-[0_0_0_3px_var(--wds-caramel-100)]',
                    )}
                  />
                </li>
              );
            })}
          </ul>
          <p role="status" className="m-0 px-0 py-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
            {remaining === 0 ? 'Every item is counted.' : `${remaining} more ${remaining === 1 ? 'item' : 'items'} to count`}
          </p>
        </div>
      )}
      {saveError ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {saveError}
        </p>
      ) : null}
    </>
  );

  const signStep = (
    <>
      <section aria-label="What you counted" className="border border-wds-border-strong border-t-2 border-t-wds-text-ink">
        <div className="flex items-start justify-between px-4 pb-3 pt-3.5">
          <div className="flex flex-col gap-0.5">
            <MonoLabel>You counted</MonoLabel>
            <span className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{itemsText(lines.length)}</span>
          </div>
          <Chip spec={{ text: 'None left blank', tone: 'success' }} size="lg" />
        </div>
        <div className="border-t border-wds-border px-4 py-2.5">
          <button type="button" onClick={() => setStep('count')} className={PRIMARY_LINK}>
            {BRANCH_DAY_BUTTONS.seeEveryFigure}
          </button>
        </div>
      </section>
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
        Recorded as counted on behalf of {name}, signed with your PIN. {name}’s head will see it on their day.
      </p>
      <div className="flex flex-col gap-1.5">
        <MonoLabel id="count-signed-by">Signed by</MonoLabel>
        <div aria-labelledby="count-signed-by" className="flex h-10 items-center border border-wds-border bg-wds-neutral-50 px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{roleLabel(user?.role)}</div>
      </div>
      <PinField id="count-pin" size="paper" value={pin} onChange={(v) => { setPin(v); if (pinError) setPinError(null); }} onSubmit={() => void submit()} error={pinError} disabled={sign.saving} />
    </>
  );

  return (
    <DrawerShell
      variant="day"
      compact
      initialFocus="[data-first-count]"
      open={open}
      onOpenChange={(next) => {
        if (!sign.saving) onOpenChange(next);
      }}
      title={`Count ${name}`}
      description="On behalf of the department · blind: nothing to count against"
      primaryLabel={step === 'count' ? BRANCH_DAY_BUTTONS.checkAndSign : sign.saving ? 'Sending the count' : `Send for ${name}`}
      onPrimaryAction={() => void (step === 'count' ? toSign() : submit())}
      primaryDisabled={step === 'count' ? remaining > 0 || lines.length === 0 || save.saving : pin.length !== 4 || sign.saving}
    >
      <div className="flex flex-col gap-3.5" aria-busy={save.saving || sign.saving}>
        {step === 'count' ? countStep : signStep}
      </div>
    </DrawerShell>
  );
}
