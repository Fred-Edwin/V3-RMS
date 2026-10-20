'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { Callout, DialogButton } from '../../_shared';
import { people } from '../_shared/lib/format';
import type { MonthSite, MonthView } from '../_shared/types/month-types';
import { LateApproveDialog, RemindDialog } from './site-dialogs';
import { oldSystemLine, remindWord, siteStatus, siteWhen } from './site-words';

const TONE = { success: 'text-wds-success-fg', warning: 'font-semibold text-wds-warning-fg', muted: 'text-wds-text-secondary' } as const;
const LINK = 'font-wds-sans text-[13px] leading-4 font-medium text-wds-text-ink underline underline-offset-2';

/** The banner for a month that waits: for sites, or for the tax tables (with the way to Rules, spec S1). */
function WaitingBanner({ view }: { view: MonthView }) {
  const banner = view.banner;
  if (!banner) return null;
  return (
    <Callout
      tone="warning"
      title={banner.title}
      role="status"
      action={banner.kind === 'TABLES' ? <Link href="/app/workforce/rules?tab=statutory" className={LINK}>Open Rules ↗</Link> : undefined}
    >
      {banner.body}
      {banner.kind === 'SITES' && view.tablesConfirmed ? ` The tax tables are already confirmed (version ${view.tablesConfirmed.version}).` : ''}
    </Callout>
  );
}

/**
 * Timesheets tab (spec S1): which sites approved, when, and a reminder for the ones that have not. A site not on the new system shows as
 * paid by the old payslips and counts for nothing. Read only for every role except the reminder and the Director's late approval.
 */
export function TimesheetsTab({ view, onChanged }: { view: MonthView; onChanged: (message?: string) => void }) {
  const [remind, setRemind] = React.useState<MonthSite | null>(null);
  const [late, setLate] = React.useState<MonthSite | null>(null);
  const old = oldSystemLine(view.sites);
  const canRemind = view.capabilities.canRemind;
  const canLate = view.capabilities.canApproveSiteLate;
  return (
    <div className="flex flex-col gap-4">
      {view.state === 'WAITING' ? <WaitingBanner view={view} /> : null}
      {view.sites.length === 0 ? (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No sites are in this month yet.</p>
      ) : (
        <div className="overflow-x-auto border border-wds-border bg-wds-surface">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Sites in {view.label}</caption>
            <thead>
              <tr className="border-b border-wds-text-ink">
                {['SITE', 'PEOPLE', 'STATUS', 'WHEN'].map((h, i) => (
                  <th key={h} scope="col" className={cn('px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary', i === 1 ? 'text-right' : 'text-left')}>
                    {h}
                  </th>
                ))}
                <th scope="col" className="px-3.5 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view.sites.map((site) => {
                const status = siteStatus(site);
                const waiting = status.tone === 'warning';
                const r = remindWord(site);
                return (
                  <tr key={site.siteId} className={cn('border-b border-wds-neutral-100', waiting && 'bg-wds-warning-bg')}>
                    <td className={cn('px-3.5 py-[13px] font-wds-sans text-[14px] leading-[18px]', waiting ? 'font-semibold' : 'font-medium', status.tone === 'muted' ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>
                      {site.timesheetState === 'APPROVED' ? (
                        <Link href={`/app/workforce/timesheets?site=${site.siteId}&month=${view.monthKey}`} className="underline-offset-2 hover:underline">
                          {site.name}
                        </Link>
                      ) : (
                        site.name
                      )}
                    </td>
                    <td className="px-3.5 py-[13px] text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{site.headcount === 0 ? 'No staff this month' : site.headcount}</td>
                    <td className={cn('px-3.5 py-[13px] font-wds-sans text-[13px] leading-4', TONE[status.tone])}>{status.word}</td>
                    <td className={cn('px-3.5 py-[13px] font-wds-sans text-[13px] leading-4', waiting ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{siteWhen(site)}</td>
                    <td className="whitespace-nowrap px-3.5 py-[13px] text-right">
                      <span className="inline-flex items-center gap-3">
                        {canRemind && r.canRemind ? (
                          <button type="button" onClick={() => setRemind(site)} className={LINK}>
                            Remind
                          </button>
                        ) : null}
                        {canRemind && r.reminded ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.reminded}</span> : null}
                        {canLate && site.canApproveLate ? (
                          <DialogButton kind="cancel" onClick={() => setLate(site)}>
                            Approve for the site
                          </DialogButton>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {old ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{old}</p> : null}
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Only a site&rsquo;s own manager approves its timesheets. HR, the Accountant and the Director can read every site ({people(view.sites.reduce((t, s) => t + s.headcount, 0))}) and send a reminder.
      </p>
      {remind ? (
        <RemindDialog
          monthKey={view.monthKey}
          site={remind}
          onClose={() => setRemind(null)}
          onDone={(message) => {
            setRemind(null);
            onChanged(message);
          }}
        />
      ) : null}
      {late ? (
        <LateApproveDialog
          monthKey={view.monthKey}
          site={late}
          onClose={() => setLate(null)}
          onStale={() => onChanged()}
          onDone={(message) => {
            setLate(null);
            onChanged(message);
          }}
        />
      ) : null}
    </div>
  );
}
