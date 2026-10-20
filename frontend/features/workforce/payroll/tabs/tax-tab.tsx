'use client';

import * as React from 'react';

import { Callout, ErrorBlock, ListSkeleton } from '../../_shared';
import { FiguresCard } from '../_shared/components/figures-card';
import { HandCheckDrawer } from '../review/hand-check-drawer';
import { useTax } from '../_shared/hooks/use-payroll-data';
import { dayMonthTime, kes, kesLabel } from '../_shared/lib/format';
import { LINK_BUTTON } from '../_shared/lib/link-style';
import { bandRows, baseWords } from '../_shared/lib/tax-words';
import type { MonthView } from '../_shared/types/month-types';
import type { TaxTable } from '../_shared/types/tab-types';

/** "ACCOUNTANT" or "HR_MANAGER" as the sentence Paper writes: "Accountant", "HR manager". */
const sentenceCase = (role: string): string => {
  const words = role.replace(/_/g, ' ').toLowerCase();
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/^Hr\b/, 'HR');
};

function TablePanel({ table }: { table: TaxTable }) {
  const cells = [
    { label: table.isIncomeTax ? 'PEOPLE TAXED' : 'PEOPLE', value: String(table.employeeShare.people) },
    { label: 'TAKEN OFF (KES)', value: kes(table.employeeShare.amount) },
    ...(table.employerShare ? [{ label: 'EMPLOYER (KES)', value: kes(table.employerShare.amount) }] : []),
  ];
  return (
    <FiguresCard
      title={table.name}
      chip={table.kind === 'BANDS' ? 'monthly bands' : undefined}
      aside={table.reliefMonthly ? `after relief ${kes(table.reliefMonthly)}` : table.kind === 'BANDS' ? undefined : 'employee share'}
      note={table.notUsed ? 'Not used this month' : undefined}
      rows={[
        ...bandRows(table).map((r) => ({ label: r.label, value: r.value, mono: true })),
        { label: 'Taken from', value: baseWords(table.base) },
        ...(table.example ? [{ label: 'Example', value: table.example.text, mono: true }] : []),
      ]}
      cells={cells}
    />
  );
}

/** Tax and deductions (spec S3): the tables as the month used them, who confirmed them, and a way to check one person by hand. */
export function TaxTab({ view, refresh, handCheck, onHandCheck }: { view: MonthView; refresh: number; handCheck: boolean; onHandCheck: (open: boolean) => void }) {
  const tax = useTax(view.monthKey, refresh);
  if (tax.status === 'loading' && !tax.data) return <ListSkeleton rows={6} columns={['fill', 120]} label="Loading the tax tables" />;
  if (tax.status === 'error' && !tax.data) return <ErrorBlock title="The tax tables did not load" line={tax.error.message} onRetry={tax.reload} reference={tax.error.code} />;
  const t = tax.data;
  if (!t) return null;
  const example = t.tables.find((x) => x.example)?.example ?? null;
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="success" role="status" actionAt="end" action={<span className="font-wds-mono text-[13px] font-semibold leading-4">Total taken off · {kesLabel(t.totalTakenOff)}</span>}>
        {t.tablesVersionLabel ?? 'Tax tables'} confirmed{t.confirmedBy ? ` by ${t.confirmedBy.name}, ${sentenceCase(t.confirmedBy.role)}` : ''}
        {t.confirmedAt ? `, ${dayMonthTime(t.confirmedAt)}` : ''}.
      </Callout>
      <div className="grid gap-4 min-[1100px]:grid-cols-2">
        {t.tables.map((table) => (
          <TablePanel key={table.code} table={table} />
        ))}
      </div>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {Number(t.employerContributions) > 0 ? `Employer contributions ${kesLabel(t.employerContributions)} are not taken from pay.` : 'Employer contributions KES 0 are not taken from pay.'}{' '}
        <button type="button" onClick={() => onHandCheck(true)} className={LINK_BUTTON}>
          Check one person by hand
        </button>
      </p>
      {handCheck ? <HandCheckDrawer monthKey={view.monthKey} defaultEmployeeId={example?.employeeId ?? null} onClose={() => onHandCheck(false)} /> : null}
    </div>
  );
}
