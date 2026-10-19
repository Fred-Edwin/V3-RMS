'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FIELD_CLASS, FormField, RadioCards } from '../../../_shared';
import { RuleChangeDialog } from '../../change/change-dialog';
import { RuleNumberInput } from '../../change/rule-number-input';
import type { LeaveType, LeaveValues } from '../../types/rules-types';
import type { EditorProps } from '../tab-types';

const daysWords = (t: LeaveType | null): string => (t === null ? 'None' : t.daysPerYear === null ? 'No limit' : `${t.daysPerYear} d`);
const whole = (text: string, max: number): number | null => (/^\d{1,3}$/.test(text) && Number(text) <= max ? Number(text) : null);
const decimal = (text: string, max: number): number | null => (/^\d{1,3}(\.\d{1,2})?$/.test(text) && Number(text) <= max ? Number(text) : null);

/** A code from the name: UPPER_SNAKE, 2 to 24 letters, made unique among the types. */
export function codeFor(label: string, taken: readonly string[]): string {
  const base = label.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'LEAVE';
  let code = base.length < 2 ? `${base}_X` : base;
  let n = 2;
  while (taken.includes(code)) code = `${base.slice(0, 20)}_${n++}`;
  return code;
}

function Num({ label, value, onChange, error, wide }: { label: string; value: string; onChange: (v: string) => void; error?: string; wide?: boolean }) {
  return (
    <FormField label={label} error={error}>
      {({ id, describedBy, invalid }) => <RuleNumberInput label={label} id={id} describedBy={describedBy} invalid={invalid} decimal value={value} onChange={onChange} className={wide ? 'w-full' : 'w-[120px]'} />}
    </FormField>
  );
}

/** Change a leave type, or add one (`type` null). HR's rule; the new numbers apply from the day chosen and past leave is never re-counted. */
export function LeaveTypeEditor({ page, type, onSaved, onStale, onClose }: EditorProps & { type: LeaveType | null }) {
  const types = (page.values as unknown as LeaveValues).leaveTypes;
  const [label, setLabel] = React.useState(type?.label ?? '');
  const [days, setDays] = React.useState(type ? (type.daysPerYear === null ? '' : String(type.daysPerYear)) : '');
  const [noLimit, setNoLimit] = React.useState(type ? type.daysPerYear === null : false);
  const [accrual, setAccrual] = React.useState<LeaveType['accrual']>(type?.accrual ?? 'UP_FRONT');
  const [perMonth, setPerMonth] = React.useState(type?.perMonthDays == null ? '' : String(type.perMonthDays));
  const [paid, setPaid] = React.useState(type ? (type.paid ? 'paid' : 'unpaid') : 'paid');
  const [carry, setCarry] = React.useState(String(type?.carryOverDays ?? 0));
  const [note, setNote] = React.useState(type?.sickNoteAfterDays == null ? '' : String(type.sickNoteAfterDays));
  const [approvedBy, setApprovedBy] = React.useState<LeaveType['approvedBy']>(type?.approvedBy ?? 'MANAGER');
  const [reasonNeeded, setReasonNeeded] = React.useState(type?.requiresReason ?? false);

  const daysN = noLimit ? null : decimal(days, 366);
  const perN = accrual === 'MONTHLY' ? decimal(perMonth, 31) : null;
  const carryN = decimal(carry, 366);
  const noteN = note === '' ? null : whole(note, 30);
  let problem: string | undefined;
  if (label.trim().length === 0 || label.trim().length > 60) problem = 'Give the leave type a name of 1 to 60 characters';
  else if (!noLimit && daysN === null) problem = 'Use days from 0 to 366, or switch on No limit';
  else if (accrual === 'MONTHLY' && perN === null) problem = 'Say how many days build up each month';
  else if (carryN === null) problem = 'Use carry over days from 0 to 366';
  else if (note !== '' && noteN === null) problem = 'Use a sick note day from 0 to 30';

  const next: LeaveType | null = problem ? null : { code: type?.code ?? codeFor(label.trim(), types.map((t) => t.code)), label: label.trim(), daysPerYear: daysN, paid: paid === 'paid', requiresReason: reasonNeeded, accrual, perMonthDays: perN, carryOverDays: carryN ?? 0, sickNoteAfterDays: noteN, approvedBy };
  const same = next !== null && type !== null && JSON.stringify(next) === JSON.stringify(type);
  const values = next && !same ? { leaveTypes: type ? types.map((t) => (t.code === type.code ? next : t)) : [...types, next] } : null;

  return (
    <RuleChangeDialog
      page={page}
      companyScope
      title={type ? `Change ${type.label.toLowerCase()} leave` : 'Add a leave type'}
      helper="Leave already taken or booked is not changed. The new numbers apply from the day you choose. Leave types are never deleted, so past leave can always be explained."
      pairs={[
        {
          now: daysWords(type),
          control: (
            <div className="flex flex-col gap-1.5">
              <RuleNumberInput label="New value: days a year" decimal disabled={noLimit} placeholder={noLimit ? 'No limit' : undefined} value={noLimit ? '' : days} onChange={setDays} />
              <label className="flex items-center gap-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                <input type="checkbox" checked={noLimit} onChange={(e) => setNoLimit(e.target.checked)} className="h-4 w-4 accent-[var(--wds-primary)]" /> No limit
              </label>
            </div>
          ),
        },
      ]}
      extra={
        <div className="flex flex-col gap-4">
          {type ? null : (
            <FormField label="Name of the leave type" hint="required">
              {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} autoComplete="off" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} className={cn(FIELD_CLASS, 'h-10')} />}
            </FormField>
          )}
          <RadioCards legend="Builds up" columns={3} value={accrual} onChange={(v) => setAccrual(v as LeaveType['accrual'])} options={[{ value: 'UP_FRONT', title: 'All at the start' }, { value: 'MONTHLY', title: 'A number a month' }, { value: 'PER_EVENT', title: 'Per event' }]} />
          {accrual === 'MONTHLY' ? <Num label="Days built up each month" value={perMonth} onChange={setPerMonth} /> : null}
          <RadioCards legend="Pay" columns={2} value={paid} onChange={setPaid} options={[{ value: 'paid', title: 'Normal pay' }, { value: 'unpaid', title: 'Not paid' }]} />
          <RadioCards legend="Approved by" columns={2} value={approvedBy} onChange={(v) => setApprovedBy(v as LeaveType['approvedBy'])} options={[{ value: 'MANAGER', title: 'The Branch Manager' }, { value: 'HR', title: 'HR' }]} />
          <div className="flex flex-wrap gap-4">
            <Num label="Carry over, up to (days)" value={carry} onChange={setCarry} />
            <Num label="Sick note after (days)" value={note} onChange={setNote} />
          </div>
          <label className="flex items-center gap-2 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            <input type="checkbox" checked={reasonNeeded} onChange={(e) => setReasonNeeded(e.target.checked)} className="h-4 w-4 accent-[var(--wds-primary)]" /> A reason is needed with each request
          </label>
          {problem ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{problem}</p> : null}
        </div>
      }
      values={values}
      draftMessage={problem ?? 'Nothing to change yet'}
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
    />
  );
}
