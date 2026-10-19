'use client';

import * as React from 'react';
import Link from 'next/link';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { Callout, DialogButton, FOCUS_RING, KitDialog, Panel, RadioCards, onHover } from '../../../_shared';
import { ChangeLink } from '../../components/change-link';
import { SideLabel } from '../../components/who-panel';
import { useOnline, useRulesHistory } from '../../hooks/use-rules-data';
import { grouped, instantDay, longDay, plainName, shortDay } from '../../lib/rules-words';
import { historyHref } from '../../lib/tab-defs';
import { appliesFrom, bandLabel, bandValue } from '../../lib/statutory-view';
import { isLocked, type StatutoryTable, type StatutoryValues } from '../../types/rules-types';
import { StatutoryEditor, type StatutoryTarget } from './statutory-editor';
import type { TabProps } from '../tab-types';

const KINDS: Record<string, { code: StatutoryTable['code']; name: string; kind: StatutoryTarget['kind'] }> = {
  NSSF: { code: 'NSSF', name: 'NSSF (employee)', kind: 'RATE' },
  SHA: { code: 'SHA', name: 'SHA (health)', kind: 'RATE' },
  HOUSING_LEVY: { code: 'HOUSING_LEVY', name: 'Housing levy (employee)', kind: 'RATE' },
  RELIEF: { code: 'RELIEF', name: 'Personal relief', kind: 'FLAT' },
  OTHER: { code: 'OTHER', name: '', kind: 'RATE' },
};

const kindOf = (t: StatutoryTable): StatutoryTarget['kind'] => (t.code === 'PAYE' ? 'BANDS' : t.code === 'RELIEF' ? 'FLAT' : 'RATE');

function DeductionPicker({ have, onPick, onClose }: { have: Set<string>; onPick: (key: string) => void; onClose: () => void }) {
  const [key, setKey] = React.useState<string | null>(null);
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add a deduction"
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" disabled={key === null} onClick={() => key && onPick(key)}>Next</DialogButton>
        </>
      }
    >
      <RadioCards
        legend="Which deduction?"
        value={key}
        onChange={setKey}
        options={Object.entries(KINDS).map(([k, v]) => ({ value: k, title: v.name || 'Another deduction', description: have.has(k) && k !== 'OTHER' ? 'Already set. Change it from the list.' : undefined, disabled: have.has(k) && k !== 'OTHER' }))}
      />
    </KitDialog>
  );
}

export function StatutoryTab({ page, onSaved, onStale }: TabProps) {
  const online = useOnline();
  const history = useRulesHistory('STATUTORY', null, 1, 25);
  const [target, setTarget] = React.useState<StatutoryTarget | null>(null);
  const [picking, setPicking] = React.useState(false);
  const answer = page.rows.tables;
  const mayEdit = Boolean(answer?.canChange);
  const tables = (page.values as unknown as StatutoryValues).tables;
  const paye = tables.find((t) => t.code === 'PAYE');
  const relief = tables.find((t) => t.code === 'RELIEF');
  const others = tables.filter((t) => t.code !== 'PAYE' && t.code !== 'RELIEF');
  const items = history.data && !isLocked(history.data) ? history.data.items : [];
  const from = (t: StatutoryTable): string => {
    const day = appliesFrom(items, (all) => all.find((x) => x.code === t.code && x.name === t.name));
    return day ? shortDay(day) : '';
  };
  const edit = (t: StatutoryTable): StatutoryTarget => ({ code: t.code, name: t.name, kind: kindOf(t), existing: t });
  const link = (t: StatutoryTable): React.ReactNode =>
    mayEdit ? (
      <ChangeLink thing={t.name} state={{ kind: 'change' }} onChange={() => setTarget(edit(t))} offline={!online} />
    ) : (
      <ChangeLink thing="the statutory rates" state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
    );

  const empty = tables.length === 0;
  const confirmed = answer?.confirmedBy && !answer.waitingForConfirmation ? answer.confirmedBy : null;

  return (
    <div className="flex flex-col gap-4">
      {empty ? (
        <Callout tone="neutral" variant="dashed" title="No statutory rates yet" action={mayEdit ? (
          <>
            <DialogButton kind="primary" onClick={() => setTarget({ code: 'PAYE', name: 'PAYE', kind: 'BANDS', existing: null })} disabled={!online}>Add PAYE bands</DialogButton>
            <DialogButton kind="cancel" onClick={() => setPicking(true)} disabled={!online}>Add a deduction</DialogButton>
          </>
        ) : undefined}>
          Payroll cannot calculate a month until the Accountant has typed and confirmed them.
        </Callout>
      ) : confirmed ? (
        <Callout tone="success" title={`Confirmed by ${plainName(confirmed.name)}, Accountant, on ${instantDay(confirmed.at)}`}>
          Payroll uses these rates. A month cannot be calculated until the Accountant has confirmed them.
        </Callout>
      ) : null}

      {empty ? null : (
        <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-2">
          <Panel title={`PAYE · MONTHLY BANDS${paye && from(paye) ? ` · FROM ${from(paye).toUpperCase()}` : ''}`} padded={false}>
            {paye ? (
              <Table look="workforce" aria-label="PAYE bands">
                <TableHeader>
                  <TableRow><TableHead>BAND (KES)</TableHead><TableHead className="text-right">RATE</TableHead><TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {paye.bands.map((b, i) => (
                    <TableRow key={b.fromAmount}>
                      <TableCell className="font-wds-mono">{bandLabel(paye.bands, i)}</TableCell>
                      <TableCell className="text-right font-wds-mono">{bandValue(b)}</TableCell>
                      <TableCell>{link(paye)}</TableCell>
                    </TableRow>
                  ))}
                  {relief ? (
                    <TableRow>
                      <TableCell className="border-t border-wds-text-ink">Personal relief per month</TableCell>
                      <TableCell className="border-t border-wds-text-ink text-right font-wds-mono">{grouped(relief.bands[0]?.flatAmount ?? '')}</TableCell>
                      <TableCell className="border-t border-wds-text-ink">{link(relief)}</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : (
              <p className="m-0 px-[18px] py-3.5 font-wds-sans text-[13px] text-wds-text-secondary">No PAYE bands yet.</p>
            )}
          </Panel>
          <Panel title="OTHER DEDUCTIONS" padded={false}>
            <Table look="workforce" aria-label="Other deductions">
              <TableHeader>
                <TableRow><TableHead>NAME</TableHead><TableHead className="text-right">RATE · APPLIES FROM</TableHead><TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {others.map((t) => (
                  <TableRow key={`${t.code}:${t.name}`}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-right font-wds-mono">{t.bands[0] ? bandValue(t.bands[0]) : ''}{from(t) ? ` · ${from(t)}` : ''}</TableCell>
                    <TableCell>{link(t)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="m-0 border-t border-wds-border px-[18px] py-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Each rate has its own start date. A payroll uses the rate that applied on its pay day.</p>
          </Panel>
        </div>
      )}

      {!empty && mayEdit ? (
        <div className="flex gap-2">
          {paye ? null : <DialogButton kind="cancel" onClick={() => setTarget({ code: 'PAYE', name: 'PAYE', kind: 'BANDS', existing: null })} disabled={!online}>Add PAYE bands</DialogButton>}
          <DialogButton kind="cancel" onClick={() => setPicking(true)} disabled={!online}>Add a deduction</DialogButton>
        </div>
      ) : null}

      {items.length > 0 ? (
        <section aria-label="Versions" className="flex flex-col gap-2">
          <SideLabel>VERSIONS</SideLabel>
          <Table look="workforce" aria-label="Statutory versions">
            <TableHeader>
              <TableRow><TableHead>VERSION</TableHead><TableHead>APPLIES FROM</TableHead><TableHead>CONFIRMED BY</TableHead><TableHead>WHAT CHANGED</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 5).map((v) => {
                const c = v.confirmations[0];
                return (
                  <TableRow key={v.id}>
                    <TableCell>Version {v.version}{v.status === 'IN_FORCE' ? ' · now' : ''}{v.status === 'WITHDRAWN' ? ' · withdrawn' : ''}</TableCell>
                    <TableCell className="font-wds-mono">{longDay(v.effectiveFrom)}</TableCell>
                    <TableCell>{c ? `${plainName(c.by.name)}, Accountant, ${instantDay(c.at)}` : 'Not confirmed'}</TableCell>
                    <TableCell>{v.changedSummary || 'Changed, see the audit log'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Old versions stay for ever so a past payslip can always be explained. Changing a rate is logged and the Director and HR are told.{' '}
            <Link href={historyHref('statutory')} className={cn('text-wds-info-fg', FOCUS_RING, onHover('underline'))}>See all versions</Link>
          </p>
        </section>
      ) : null}

      {picking ? (
        <DeductionPicker
          have={new Set(tables.map((t) => t.code))}
          onClose={() => setPicking(false)}
          onPick={(key) => {
            const k = KINDS[key];
            setPicking(false);
            if (k) setTarget({ ...k, existing: null });
          }}
        />
      ) : null}
      {target ? (
        <StatutoryEditor
          page={page}
          target={target}
          onSaved={(saved) => {
            history.reload();
            onSaved(saved);
          }}
          onStale={onStale}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </div>
  );
}
