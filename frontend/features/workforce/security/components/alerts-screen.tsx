'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout, DialogButton, EmptyState, ErrorBlock, FilterBar, FilterChip, FOCUS_RING, ListSkeleton, PageHeader, StatusTag, WorkforceFrame, useNow } from '../../_shared';
import { useAlerts } from '../hooks/use-alerts';
import { ALERT_COPY, ALERT_KIND_LABEL, placeWords, whenLabel } from '../lib/security-words';
import type { AlertKind, AlertRow } from '../types/security-types';
import { AlertPanel } from './alert-panel';

const KINDS: AlertKind[] = ['WASNT_ME', 'UNCONFIRMED_PHONE', 'WRONG_CODES', 'CHAIN_FAILED'];

/**
 * Security alerts, the System Admin's view (6a S1, designed from the kit: Paper describes it but does not draw it). Status chips with
 * counts, a Kind filter, the table, a numbered pager, and a right panel for the chosen alert. "Start alerts" appears until the rollout
 * gate is pressed. It informs and clears; it never shows an amount, a code or a payslip number, and plays no sound.
 */
export function AlertsScreen() {
  const now = useNow();
  const alerts = useAlerts();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const items = alerts.list.data?.items ?? [];
  const open = items.find((a) => a.id === chosen) ?? null;
  const counts = alerts.counts.data;

  const clear = async (alert: AlertRow, note: string): Promise<boolean> => {
    const cleared = await alerts.clear(alert, note);
    if (cleared) {
      setDone(true);
      window.setTimeout(() => setDone(false), 6000);
    }
    return cleared !== null;
  };

  let table: React.ReactNode;
  if (alerts.list.status === 'loading') table = <ListSkeleton rows={5} columns={[110, 'fill', 120]} label="Loading alerts" />;
  else if (alerts.list.status === 'error' && !alerts.list.data) {
    table = <ErrorBlock title="We could not load the alerts." line="Nothing was changed." reference={alerts.list.error.code === 'NETWORK' ? undefined : alerts.list.error.code} onRetry={alerts.list.reload} />;
  } else if (items.length === 0) {
    table = <EmptyState kind={alerts.kind || alerts.status !== 'OPEN' ? 'nothingFound' : 'nothingYet'} title={ALERT_COPY.empty} />;
  } else {
    table = (
      <div className="flex flex-col">
        <Table look="workforce" aria-label="Security alerts">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">When</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Place</TableHead>
              <TableHead className="w-[170px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id} size="compact" data-state={a.id === chosen ? 'selected' : undefined}>
                <TableCell className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{whenLabel(a.occurredAt, now)}</TableCell>
                <TableCell className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', 'border-l-[3px]', a.kind === 'WASNT_ME' ? 'border-l-wds-error-fg' : 'border-l-wds-caramel-500')}>
                  <button type="button" aria-current={a.id === chosen ? 'true' : undefined} onClick={() => setChosen(a.id)} className={cn('text-left', a.id === chosen && 'font-semibold', FOCUS_RING)}>
                    {ALERT_KIND_LABEL[a.kind]}
                  </button>
                </TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{a.person ? `${a.person.name}, ${a.person.role}` : '—'}</TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{a.deviceLabel ?? '—'}</TableCell>
                <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{a.placeLabel ? placeWords(a.placeLabel) : '—'}</TableCell>
                <TableCell>
                  {a.status === 'OPEN' ? (
                    <StatusTag tone="warning">Open</StatusTag>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      <StatusTag tone="success" className="w-fit">Cleared</StatusTag>
                      {a.clearedBy ? <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">by {a.clearedBy.name}, {a.clearedBy.role}</span> : null}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePager page={alerts.page} perPage={alerts.pageSize} shown={items.length} total={alerts.list.data?.total ?? items.length} onPageChange={alerts.setPage} onPerPageChange={alerts.changePageSize} />
      </div>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Settings', screen: ALERT_COPY.title }} phoneTitle={ALERT_COPY.title} label={ALERT_COPY.title}>
      <div className="flex flex-col gap-4 px-8 py-7">
        <PageHeader size="lg" title={ALERT_COPY.title} subtitle={ALERT_COPY.subtitle} />
        {counts && !counts.alertsStarted ? (
          <Callout tone="warning" title={ALERT_COPY.startTitle} action={<DialogButton kind="primary" disabled={alerts.busy} onClick={() => void alerts.start()}>{ALERT_COPY.start}</DialogButton>}>
            {ALERT_COPY.startLine}
          </Callout>
        ) : null}
        {done ? <Callout tone="success" role="status">{ALERT_COPY.cleared}</Callout> : null}
        <FilterBar
          chips={
            <>
              <FilterChip label="Open" count={counts?.open} selected={alerts.status === 'OPEN'} onClick={() => alerts.choose('OPEN')} />
              <FilterChip label="Cleared" count={counts?.cleared} selected={alerts.status === 'CLEARED'} onClick={() => alerts.choose('CLEARED')} />
              <FilterChip label="All" count={counts?.all} selected={alerts.status === 'ALL'} onClick={() => alerts.choose('ALL')} />
            </>
          }
          trailing={
            <Select value={alerts.kind ?? 'ANY'} onValueChange={(v) => alerts.chooseKind(v === 'ANY' ? null : (v as AlertKind))}>
              <SelectTrigger aria-label="Kind" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Every kind</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {ALERT_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <div className="flex items-start gap-5 max-lg:flex-col">
          <div className="min-w-0 flex-1">{table}</div>
          {open ? <AlertPanel key={open.id} alert={open} now={now} busy={alerts.busy} error={alerts.error} onClear={(note) => clear(open, note)} onClose={() => setChosen(null)} /> : null}
        </div>
      </div>
    </WorkforceFrame>
  );
}
