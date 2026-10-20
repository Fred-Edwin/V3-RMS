'use client';

import { EmptyState, UnderlineTabs } from '../../_shared';
import { EstimatePanel } from '../estimate/estimate-panel';
import { TimesheetsTab } from '../sites/timesheets-tab';
import { LINK_BUTTON } from '../_shared/lib/link-style';
import { TAB_LABELS, TAB_OFF_REASON, TAB_ORDER, activeTab, defaultTab } from '../_shared/lib/month-view';
import type { MonthView } from '../_shared/types/month-types';
import type { EstimateView } from '../_shared/types/tab-types';
import type { DialogName } from '../actions/payroll-dialogs';
import { CasualTab } from './casual-tab';
import { PayslipsTab } from './payslips-tab';
import { RulesTab } from './rules-tab';
import { TaxTab } from './tax-tab';
import { TotalsTab } from './totals-tab';

type UrlLike = { get: (key: string) => string | null; set: (patch: Record<string, string | null>) => void };

/**
 * The six tabs of a month (spec S-shell). A tab is on when there is something to show: Timesheets always, the calculated tabs from
 * Calculated, Payslips from Approved. A tab that is off is dimmed, says why, and cannot be reached by address. The running month has no
 * tabs: it shows the estimate, for the roles that may read it.
 */
export function PayrollTabs({
  view,
  url,
  refresh,
  onChanged,
  onOpenDialog,
  estimate,
  canEstimate,
  oldPayslipsHref,
}: {
  view: MonthView;
  url: UrlLike;
  refresh: number;
  onChanged: (message?: string) => void;
  onOpenDialog: (name: DialogName) => void;
  estimate: EstimateView | null;
  canEstimate: boolean;
  oldPayslipsHref: string | undefined;
}) {
  if (view.state === 'OPEN') {
    if (!canEstimate) return <EmptyState kind="nothingYet" title="The month is still running" line="Payroll is worked out after the month ends." />;
    return <EstimatePanel monthLabel={view.label.split(' ')[0] ?? view.label} estimate={estimate?.ready ? estimate.estimate : null} ready={estimate?.ready ?? false} computedAt={estimate?.ready ? estimate.computedAt : null} />;
  }
  const home = defaultTab(view.state, view.capabilities.canReview, view.tabs);
  const tab = activeTab(url.get('tab'), view.tabs, home);
  const choose = (value: string): void => url.set({ tab: value === home ? null : value, q: null, page: null, rows: null, site: null, status: null, handcheck: null });
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <UnderlineTabs
        label="Month sections"
        className="overflow-y-hidden"
        value={tab}
        onChange={choose}
        items={TAB_ORDER.map((key) => ({ value: key, label: TAB_LABELS[key], disabled: !view.tabs.includes(key) }))}
      />
      {view.tabs.length === 1 ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{TAB_OFF_REASON}.</p> : null}
      <div role="tabpanel" aria-label={TAB_LABELS[tab]} className="flex min-h-0 flex-col gap-4">
        {tab === 'timesheets' ? <TimesheetsTab view={view} onChanged={onChanged} /> : null}
        {tab === 'rules' ? <RulesTab monthKey={view.monthKey} refresh={refresh} /> : null}
        {tab === 'tax' ? <TaxTab view={view} refresh={refresh} handCheck={url.get('handcheck') === '1'} onHandCheck={(open) => url.set({ handcheck: open ? '1' : null })} /> : null}
        {tab === 'casual' ? <CasualTab monthKey={view.monthKey} refresh={refresh} /> : null}
        {tab === 'totals' ? <TotalsTab view={view} refresh={refresh} onChanged={onChanged} onOpenDialog={onOpenDialog} /> : null}
        {tab === 'payslips' ? <PayslipsTab view={view} url={url} refresh={refresh} onChanged={onChanged} /> : null}
      </div>
      {oldPayslipsHref && view.sites.some((s) => s.timesheetState === 'NOT_ON_NEW_SYSTEM') ? (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          Sites not on the new system are still paid on the{' '}
          <a href={oldPayslipsHref} className={LINK_BUTTON}>
            old Payslips page
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
