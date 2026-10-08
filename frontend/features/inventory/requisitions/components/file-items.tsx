'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { cn } from '@/lib/cn';
import { useAction } from '../../_shared/hooks/use-async';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { RequisitionFile, RequisitionLine, SectionDetail } from '../_shared/types/requisitions-contract';
import { CHANGE_REASON_CHIPS, clock, errorWords, kes, railWords, type ChangeReasonChip } from '../_shared/lib/requisitions-words';
import { MonoLabel } from './req-parts';

const num = (value: string | null): number => (value === null ? NaN : Number(value));

/** "Beef patty 120g: 30 to 24" popover with reason chips (Paper step 9). Reason is optional before approval and required after. */
function ChangePopover({ line, from, to, reasonRequired, saving, failure, onSave, onCancel }: {
  line: RequisitionLine;
  from: string;
  to: string;
  reasonRequired: boolean;
  saving: boolean;
  failure: string | null;
  onSave: (reason: string | undefined) => void;
  onCancel: () => void;
}) {
  const [chip, setChip] = React.useState<ChangeReasonChip | null>(null);
  const [other, setOther] = React.useState('');
  const first = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => first.current?.focus(), []);
  const reason = chip === 'Other' ? other.trim() : (chip ?? '');
  const blocked = reasonRequired && reason === '';
  return (
    <div
      role="dialog"
      aria-label={`Change ${line.itemName}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="absolute right-0 top-[calc(100%-4px)] z-20 w-[360px] border border-wds-border-strong bg-wds-surface p-4 shadow-wds-md"
    >
      <p className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">
        {line.itemName}: {from} to {to}
      </p>
      <p className="mt-1 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
        {reasonRequired ? 'The head is told. A reason is needed now the requisition is approved.' : 'The head is told. Add a reason if it helps (optional).'}
      </p>
      <div role="radiogroup" aria-label="Reason" className="mt-3 flex flex-wrap gap-2">
        {CHANGE_REASON_CHIPS.map((c, i) => (
          <button
            key={c}
            ref={i === 0 ? first : undefined}
            type="button"
            role="radio"
            aria-checked={chip === c}
            onClick={() => setChip(chip === c ? null : c)}
            className={cn('h-8 border px-3 font-wds-sans text-[13px] outline-none focus-visible:shadow-wds-ring', chip === c ? 'border-wds-neutral-950 bg-wds-neutral-950 text-wds-neutral-0' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50')}
          >
            {c}
          </button>
        ))}
      </div>
      {chip === 'Other' ? <Input aria-label="Other reason" className="mt-3" value={other} maxLength={120} onChange={(event) => setOther(event.target.value)} placeholder="What is the reason?" /> : null}
      {failure ? <p role="alert" className="mt-3 font-wds-sans text-[13px] text-wds-error-fg">{failure}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-3">
        {reasonRequired ? (
          <button type="button" onClick={onCancel} className="font-wds-sans text-[14px] text-wds-text-secondary outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">Cancel</button>
        ) : (
          <button type="button" onClick={() => onSave(undefined)} disabled={saving} className="font-wds-sans text-[14px] text-wds-text-secondary outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">Skip</button>
        )}
        <Button onClick={() => onSave(reason || undefined)} disabled={saving || blocked}>
          {saving ? 'Saving…' : 'Save change'}
        </Button>
      </div>
    </div>
  );
}

function LineRow({ file, section, line, onChanged }: { file: RequisitionFile; section: SectionDetail; line: RequisitionLine; onChanged: () => void }) {
  const current = line.approvedQty ?? line.requestedQty;
  const [draft, setDraft] = React.useState(current);
  const [asking, setAsking] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const editable = file.can.changeQuantity && section.can.changeQuantity && line.additionId === null;
  const afterApproval = file.status === 'APPROVED';
  const save = useAction((input: { approvedQty: string; reason?: string }) => requisitionsApi.changeQuantity(file.id, line.id, input), 'Could not save the change. Try again.');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const failure = save.failure ? errorWords(save.failure.code, 'manager', save.failure.message, save.failure.message) : null;

  React.useEffect(() => setDraft(current), [current]);

  const revert = (): void => {
    setDraft(current);
    setAsking(false);
    save.clear();
    inputRef.current?.focus();
  };
  const commit = (): void => {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next) || next < 0) return revert();
    if (next === num(current)) return setAsking(false);
    setAsking(true);
  };
  const doSave = async (reason: string | undefined): Promise<void> => {
    const result = await save.run({ approvedQty: String(Number(draft)), reason });
    if (result) {
      setAsking(false);
      setMessage(`${line.itemName} changed ${line.requestedQty} to ${result.line.approvedQty ?? draft}. The ${section.departmentName} head has been told.`);
      onChanged();
    }
  };

  const changed = line.changedByManager;
  const stock = line.onHand !== undefined ? `On hand ${line.onHand}${line.level !== undefined ? ` · Restock level ${line.level}` : ''}` : null;
  return (
    <li className={cn('relative grid grid-cols-[1fr_130px_150px_110px] items-center gap-4 border-b border-wds-border px-4 py-3', changed && 'border-l-[3px] border-l-wds-caramel-500 bg-wds-caramel-100 pl-[13px]')}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{line.itemName}</span>
        {changed ? (
          <span className="font-wds-sans text-[14px] leading-[18px] text-wds-warning-fg">
            You changed {line.requestedQty} to {line.approvedQty}. The {section.departmentName} head will be told.
          </span>
        ) : stock ? (
          <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{stock}</span>
        ) : null}
        {line.additionId ? <span className="font-wds-sans text-[13px] text-wds-warning-fg">Added after approval</span> : null}
      </div>
      <span className="text-right font-wds-mono text-[15px] text-wds-text-ink">
        {line.requestedQty} {line.unit}
      </span>
      <div className="relative">
        {editable ? (
          <Input
            ref={inputRef}
            aria-label={`Approved quantity for ${line.itemName}`}
            inputMode="decimal"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (!asking) commit();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') revert();
            }}
            className={cn('h-[34px] text-right font-wds-mono text-[15px]', asking && 'border-wds-primary shadow-wds-ring')}
          />
        ) : (
          <span className="block text-right font-wds-mono text-[15px] text-wds-text-ink">{line.approvedQty ?? '—'}</span>
        )}
        {asking ? <ChangePopover line={line} from={current} to={String(Number(draft))} reasonRequired={afterApproval} saving={save.saving} failure={failure} onSave={(reason) => void doSave(reason)} onCancel={revert} /> : null}
      </div>
      <span className="text-right font-wds-mono text-[15px] text-wds-text-ink">{line.valueKes === undefined ? '' : kes(line.valueKes)}</span>
      <p role="status" aria-live="polite" className="sr-only">{message}</p>
    </li>
  );
}

/** Paper steps 8, 9, 12, 13: the department rail and the selected department's lines. */
export function FileItems({ file, selected, onSelect, onChanged, onFillMyself }: {
  file: RequisitionFile;
  selected: string;
  onSelect: (departmentId: string) => void;
  onChanged: () => void;
  onFillMyself: (departmentId: string) => void;
}) {
  const section = file.sections.find((s) => s.departmentId === selected) ?? file.sections[0];
  const money = file.valueKes !== undefined;
  const inCount = file.sections.filter((s) => s.status === 'SUBMITTED' || s.status === 'SKIPPED').length;
  const railTitle = file.status === 'APPROVED' || file.status === 'CLOSED' ? 'Departments · approved' : `Departments · ${inCount === file.sections.length ? 'all' : inCount} ${inCount === file.sections.length ? `${file.sections.length} in` : `of ${file.sections.length} in`}`;
  if (!section) return null;
  const mainLines = section.lines.filter((l) => l.additionId === null);
  const empty = mainLines.length === 0;
  return (
    <div className="grid min-h-[420px] grid-cols-[300px_1fr] border-t border-wds-border">
      <nav aria-label="Departments" className="flex flex-col border-r border-wds-neutral-950 bg-wds-neutral-50">
        <MonoLabel className="px-4 py-3.5">{railTitle}</MonoLabel>
        <ul className="border-t border-wds-neutral-950">
          {file.sections.map((s) => {
            const words = railWords(s, file.status);
            const on = s.departmentId === section.departmentId;
            const done = s.status === 'SUBMITTED' || s.status === 'SKIPPED';
            return (
              <li key={s.departmentId}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onSelect(s.departmentId)}
                  className={cn('flex w-full flex-col gap-0.5 border-b border-wds-border px-4 py-3 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]', on ? 'border-l-[3px] border-l-wds-caramel-500 bg-wds-caramel-100 pl-[13px]' : 'hover:bg-wds-neutral-100')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5 font-wds-sans text-[16px] text-wds-text-ink">
                      <span aria-hidden className={cn('size-2 rounded-full', done ? 'bg-wds-success-fg' : 'border border-wds-text-secondary')} />
                      {s.departmentName}
                    </span>
                    {s.valueKes !== undefined && done ? <span className="font-wds-mono text-[15px] text-wds-text-ink">{kes(s.valueKes)}</span> : null}
                  </span>
                  <span className="flex items-center justify-between pl-[18px] font-wds-sans text-[14px] text-wds-text-secondary">
                    <span className={file.status === 'APPROVED' && s.status === 'SUBMITTED' ? 'text-wds-info-fg' : undefined}>{words.line}</span>
                    {words.changed ? <span className="text-wds-warning-fg">{words.changed}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between bg-wds-neutral-100 px-4 py-3 font-wds-sans text-[14px] text-wds-text-secondary">
          <span>
            {file.status === 'OPEN' ? 'So far' : 'Total'} · {file.lineCount} lines
          </span>
          {money ? <span className="font-wds-mono text-[15px] font-semibold text-wds-text-ink">{kes(file.valueKes ?? '0')}</span> : null}
        </div>
      </nav>

      <section aria-label={`${section.departmentName} lines`} className="flex min-w-0 flex-col px-5 pb-4 pt-3">
        <div className="flex items-start justify-between gap-4 pb-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-wds-sans text-[22px] font-semibold leading-7 tracking-tight text-wds-text-ink">{section.departmentName}</h2>
            <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
              {section.status === 'SUBMITTED' && section.sentAt
                ? `${mainLines.length} lines · sent at ${clock(section.sentAt)} by the ${section.sentBy?.roleLabel ?? `${section.departmentName} head`}`
                : section.status === 'SKIPPED' && section.skippedAt
                  ? `Sent without this section at ${clock(section.skippedAt)}`
                  : railWords(section, file.status).line}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {section.can.fillMyself && (section.status === 'NOT_STARTED' || section.status === 'DRAFT') ? (
              <Button variant="secondary" onClick={() => onFillMyself(section.departmentId)}>
                Fill it myself
              </Button>
            ) : null}
            {money && section.valueKes !== undefined ? <span className="font-wds-mono text-[20px] text-wds-text-ink">KES {kes(section.valueKes)}</span> : null}
          </div>
        </div>
        {empty ? (
          <p className="border-t border-wds-border py-8 font-wds-sans text-[15px] leading-[22px] text-wds-text-secondary">
            {section.status === 'SKIPPED' ? `The requisition went on without ${section.departmentName}.` : section.status === 'NOT_STARTED' ? `${section.departmentName} hasn't started. Nudge them above, or fill it yourself.` : `${section.departmentName} is still drafting. Their lines show here once they send.`}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_130px_150px_110px] gap-4 border-y border-wds-border px-4 py-2.5">
              <MonoLabel>Item</MonoLabel>
              <MonoLabel className="text-right">Requested</MonoLabel>
              <MonoLabel className="text-right">Approved</MonoLabel>
              <MonoLabel className="text-right">{money ? 'Value (KES)' : ''}</MonoLabel>
            </div>
            <ul className="border-b border-wds-neutral-950">
              {mainLines.map((line) => (
                <LineRow key={line.id} file={file} section={section} line={line} onChanged={onChanged} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
