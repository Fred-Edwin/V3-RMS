'use client';

import * as React from 'react';

import { DialogButton, PageHeader, StatusTag, WorkforceKpiStrip, type WorkforceKpiCell } from '../../../_shared';
import { approvedStamp, kpiCells, monthName, needsAnnouncement } from '../../_shared/lib/month-words';
import type { MonthView } from '../../_shared/types/month-types';
import { notYetReason } from '../../approve/lib/approve-view';

const SUBTITLE = 'One timesheet per month. Pick a month, check the hours, decide the overtime, then approve it for payroll.';

/**
 * The page header and the four numbers (spec S1 and S8). Export shows for whoever the server says may export; Approve for the site's
 * approver only; an approved month shows the green "Approved ✓" status and the document number instead.
 */
export function MonthHead({
  title,
  month,
  siteName,
  onExport,
  onApprove,
  onShowNeeds,
}: {
  title: string;
  month: MonthView | null;
  siteName: string;
  onExport: () => void;
  onApprove: () => void;
  onShowNeeds: () => void;
}) {
  const approved = month?.state === 'APPROVED' ? month.approval : null;
  const subtitle = approved ? (
    <>
      Approved and sent to payroll on {approvedStamp(approved.approvedAt)}. The hours are locked; to change them, ask HR.
      {approved.documentNumber ? <span className="ml-2 font-wds-mono text-[12px]">{approved.documentNumber}</span> : null}
    </>
  ) : (
    SUBTITLE
  );
  const name = month ? monthName(month.monthKey) : '';
  const actions = month ? (
    <>
      {month.capabilities.canExport ? (
        <DialogButton kind="cancel" size="lg" onClick={onExport} aria-haspopup="dialog">
          Export ▾
        </DialogButton>
      ) : null}
      {approved ? (
        <StatusTag tone="success" size="header" className="px-3.5 text-[13px] font-semibold leading-4">
          Approved ✓
        </StatusTag>
      ) : month.capabilities.canApprove ? (
        <div className="flex flex-col items-end gap-1">
          <DialogButton kind="primary" size="lg" disabled={month.state === 'OPEN'} onClick={onApprove} aria-describedby={month.state === 'OPEN' ? 'approve-reason' : undefined}>
            Approve {name}
          </DialogButton>
          {month.state === 'OPEN' ? (
            <span id="approve-reason" className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {notYetReason(name, month.window.end, month.approvableFrom)}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  ) : undefined;
  const cells: WorkforceKpiCell[] | null = month
    ? kpiCells(month).map((c) => ({ key: c.key, label: c.label, value: c.value, detail: c.detail, ...(c.actionable ? { actionable: true, onSelect: onShowNeeds } : {}), ...(c.tone === 'success' ? { tone: 'success' as const } : {}) }))
    : null;
  return (
    <>
      <PageHeader size="lg" title={`${title}${siteName ? ` · ${siteName}` : ''}`} subtitle={subtitle} actions={actions} />
      {cells ? (
        <>
          <WorkforceKpiStrip aria-label={`${name}, the month at a glance`} cells={cells} />
          <p className="sr-only" role="status">{needsAnnouncement(month!)}</p>
        </>
      ) : (
        <div aria-hidden className="grid grid-cols-2 gap-px border border-wds-border bg-wds-border sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[92px] animate-pulse bg-wds-neutral-50" />
          ))}
        </div>
      )}
    </>
  );
}
