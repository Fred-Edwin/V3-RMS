'use client';

import * as React from 'react';

import { FIELD_CLASS, FormField, PersonRadioList, type PersonChoice } from '../../../_shared';
import { leaveReads } from '../../_shared/services/leave-services';
import type { BalanceRow } from '../../_shared/types/leave-types';

export interface PickedPerson {
  id: string;
  name: string;
  roleLabel: string;
}

const lineOf = (row: BalanceRow): string => `${row.roleLabel}${row.department ? ` · ${row.department}` : ''} · ${row.siteName}`;

/** Type-ahead for the Person field of Adjust a balance: type two letters, pick one of at most six matches. */
export function PersonPicker({ value, onChange, site }: { value: PickedPerson | null; onChange: (person: PickedPerson) => void; site: string | undefined }) {
  const [term, setTerm] = React.useState('');
  const [rows, setRows] = React.useState<BalanceRow[]>([]);
  const [state, setState] = React.useState<'idle' | 'loading' | 'failed'>('idle');

  React.useEffect(() => {
    if (term.trim().length < 2) {
      setRows([]);
      setState('idle');
      return;
    }
    let cancelled = false;
    setState('loading');
    const timer = window.setTimeout(() => {
      leaveReads.balances({ filter: 'all', q: term.trim(), site, page: 1, rows: 6 }).then(
        (page) => { if (!cancelled) { setRows(page.rows); setState('idle'); } },
        () => { if (!cancelled) setState('failed'); }
      );
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term, site]);

  const choices: PersonChoice[] = rows.map((r) => ({ value: r.employeeId, name: r.name, line: lineOf(r) }));
  return (
    <div className="flex flex-col gap-2">
      <FormField label="Person" helper={value ? `${value.name} · ${value.roleLabel}` : 'Type a name'}>
        {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search a name" className={FIELD_CLASS} />}
      </FormField>
      {state === 'failed' ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">Could not search. Try again.</p> : null}
      {choices.length > 0 ? (
        <PersonRadioList legend="Matches" people={choices} value={value?.id ?? null} onChange={(id) => { const r = rows.find((x) => x.employeeId === id); if (r) onChange({ id: r.employeeId, name: r.name, roleLabel: r.roleLabel }); }} />
      ) : term.trim().length >= 2 && state === 'idle' ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Nobody found.</p> : null}
    </div>
  );
}
