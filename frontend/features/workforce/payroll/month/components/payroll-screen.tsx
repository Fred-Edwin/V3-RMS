'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { Callout, DialogButton, EmptyState, ErrorBlock, ListSkeleton, PageHeader, WorkforceFrame, WorkforceKpiStrip, useWorkforcePermissions } from '../../../_shared';
import { PayrollDialogs, type DialogName } from '../../actions/payroll-dialogs';
import { useMonthList, useMonthView, useEstimate } from '../../_shared/hooks/use-payroll-data';
import { LINK_BUTTON } from '../../_shared/lib/link-style';
import { defaultMonth, headerAction, headerActionLabel, isLocked, sendBlockedReason } from '../../_shared/lib/month-view';
import { HowItWorks } from '../../help/how-payroll-works';
import { PayrollTabs } from '../../tabs/payroll-tabs';
import { usePayrollUrl, useRefreshOnFocus } from '../hooks/use-payroll-url';
import { stripCells } from '../lib/strip-cells';
import { MonthPicker } from './month-picker';
import { MonthsList } from './months-list';
import { StageLine } from './stage-line';

/** Where the old payslip run lives for each role, for the "payroll has not started yet" door and the sites that are not on the new system. */
const OLD_PAYSLIPS: Record<string, string> = { ACCOUNTANT: '/app/payslips', HR_MANAGER: '/app/hr/payroll', DIRECTOR: '/app/hr/payroll', SYSTEM_ADMIN: '/app/hr/payroll' };

/**
 * Payroll (spec S-shell): one page per calendar month for the whole company. Pick a month, see where it stands, work the stage you own.
 * Buttons follow the server's `capabilities` for the month, never a role name. A month moves under two people at once: every act carries
 * the month's `stateVersion`, and the page reloads after any act and when the tab comes back after a minute.
 */
export function PayrollScreen() {
  const permissions = useWorkforcePermissions();
  const role = useAuthStore((s) => s.role);
  const router = useRouter();
  const url = usePayrollUrl();
  const [refresh, setRefresh] = React.useState(0);
  const [listPage, setListPage] = React.useState(1);
  const [dialog, setDialog] = React.useState<DialogName | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const readable = permissions.ready && permissions.can('payroll.read');

  const list = useMonthList(listPage, refresh, readable);
  const monthKey = url.get('month') ?? (list.data ? defaultMonth(list.data.items) : null);
  const month = useMonthView(monthKey, refresh, readable && (list.data?.items.length ?? 0) > 0);
  const view = month.data;
  const wantsEstimate = view?.state === 'OPEN' && permissions.can('payroll.estimate.read');
  const estimate = useEstimate(monthKey ?? '', Boolean(wantsEstimate));
  const stored = estimate.data?.ready ? estimate.data.estimate : null;

  useRefreshOnFocus(60_000, () => setRefresh((n) => n + 1));
  React.useEffect(() => {
    if (!said) return undefined;
    const timer = window.setTimeout(() => setSaid(null), 8000);
    return () => window.clearTimeout(timer);
  }, [said]);
  const changed = React.useCallback((message?: string): void => {
    if (message) setSaid(message);
    setRefresh((n) => n + 1);
  }, []);
  const oldPayslips = role ? OLD_PAYSLIPS[role] : undefined;
  const chooseMonth = (key: string): void => {
    setSaid(null);
    url.set({ month: key, tab: null, q: null, page: null, rows: null, site: null, status: null, payslip: null });
  };

  const action = view ? headerAction(view.state, view.capabilities) : null;
  const actionDialog: Record<string, DialogName> = { SEND: 'send', APPROVE: 'approve', PUBLISH: 'publish', MARK_PAID: 'pay' };
  const canExport = view?.capabilities.canExport === true;
  const sendBlock = action === 'SEND' ? sendBlockedReason(view?.kpis?.openLines ?? 0, view?.kpis?.blockingLines ?? 0) : null;

  let body: React.ReactNode;
  if (!permissions.ready || (list.status === 'loading' && !list.data)) body = <ListSkeleton rows={6} columns={[200, 'fill', 120]} label="Loading Payroll" />;
  else if (!permissions.can('payroll.read')) body = <EmptyState kind="nothingFound" title="No access" line="Your role does not read payroll." />;
  else if (list.status === 'error' && !list.data) body = <ErrorBlock title="Payroll did not load" line={list.error.message} onRetry={list.reload} reference={list.error.code} />;
  else if (list.data && list.data.items.length === 0) {
    body = (
      <EmptyState
        kind="nothingYet"
        title="Payroll has not started yet"
        line="Payroll starts with the first month a branch's new clock was on. Until then payslips are made on the old Payslips page."
        action={oldPayslips ? { label: 'Old Payslips', onClick: () => router.push(oldPayslips) } : undefined}
      />
    );
  } else {
    body = (
      <>
        {said ? (
          <Callout tone="success" size="sm" role="status">
            {said}
          </Callout>
        ) : null}
        {month.status === 'error' && !view ? <ErrorBlock title="This month did not load" line={month.error.message} onRetry={month.reload} reference={month.error.code} /> : null}
        {view ? (
          <WorkforceKpiStrip aria-label={`${view.label}, where it stands`} cells={stripCells(view, stored)} />
        ) : null}
        {/* The hairline is this row's own top border, so the months list's vertical divider meets it. The row fills the rest of the page at any screen height. */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-wds-neutral-950 min-[1100px]:min-h-[520px] min-[1100px]:flex-row">
          <MonthPicker data={list.data} selected={monthKey} onSelect={chooseMonth} />
          <MonthsList status={list.status === 'error' ? 'error' : list.status} data={list.data} selected={monthKey} page={listPage} onSelect={chooseMonth} onPage={setListPage} onRetry={list.reload} onEmptyLink={() => oldPayslips && router.push(oldPayslips)} />
          <section aria-label={view ? `${view.label}, the month` : 'The month'} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pb-6 pt-4 min-[1100px]:pl-6">
            {view && monthKey ? (
              <>
                {view.state === 'OPEN' ? null : <StageLine stages={view.stages} />}
                {isLocked(view) ? (
                  <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                    Locked on {view.lockedAt ? new Date(view.lockedAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }) : 'payment'}. Nothing can be changed.
                  </p>
                ) : null}
                <PayrollTabs view={view} url={url} refresh={refresh} onChanged={changed} onOpenDialog={setDialog} estimate={estimate.data} canEstimate={permissions.can('payroll.estimate.read')} oldPayslipsHref={oldPayslips} />
              </>
            ) : month.status === 'loading' ? (
              <ListSkeleton rows={8} columns={[160, 'fill', 80, 80]} label="Loading the month" />
            ) : null}
          </section>
        </div>
      </>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Payroll' }} phoneTitle="Payroll" label="Payroll" className="px-4 pb-0 pt-6 lg:px-8 lg:pt-7">
      <div className="mx-auto flex min-h-full w-full max-w-[1140px] flex-col gap-4">
        <PageHeader
          size="lg"
          title="Payroll"
          subtitle={
            <>
              One page for each month, for the whole company.{' '}
              <button type="button" onClick={() => setHelpOpen(true)} className={LINK_BUTTON}>
                How payroll works
              </button>
            </>
          }
          actions={
            view ? (
              <>
                {canExport || view.state === 'OPEN' || view.state === 'WAITING' ? (
                  <DialogButton kind="cancel" size="lg" disabled={!canExport} title={canExport ? undefined : 'Nothing is calculated yet.'} onClick={() => setDialog('export')} aria-haspopup="dialog">
                    Export ▾
                  </DialogButton>
                ) : null}
                {action ? (
                  <span className="flex flex-col items-end gap-1">
                    <DialogButton kind="primary" size="lg" disabled={sendBlock !== null} aria-describedby={sendBlock ? 'send-reason' : undefined} onClick={() => setDialog(actionDialog[action] ?? null)}>
                      {headerActionLabel(action, view.monthKey)}
                    </DialogButton>
                    {sendBlock ? (
                      <span id="send-reason" className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                        {sendBlock}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </>
            ) : null
          }
        />
        {body}
      </div>
      <HowItWorks open={helpOpen} onClose={() => setHelpOpen(false)} />
      {dialog && view && monthKey ? <PayrollDialogs name={dialog} view={view} onClose={() => setDialog(null)} onChanged={changed} /> : null}
    </WorkforceFrame>
  );
}
