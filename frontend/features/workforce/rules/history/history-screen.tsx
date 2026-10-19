'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { Picker } from '@/components/ui2/picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';

import { Callout, DialogButton, EmptyState, ErrorBlock, FOCUS_RING, ListSkeleton, PageHeader, StatusTag, WorkforceFrame, onHover, useWorkforcePermissions } from '../../_shared';
import { useRulesHistory } from '../hooks/use-rules-data';
import { andList, instantDay, longDay, ROLE_NAMES } from '../lib/rules-words';
import { rulesHref, tabOfSlug } from '../lib/tab-defs';
import { isLocked, type HistoryItem } from '../types/rules-types';
import { WithdrawDialog } from './withdraw-dialog';

const TOLD_WORDS: Record<string, string> = { BRANCH_MANAGER: 'Branch Managers', HR_MANAGER: 'HR', ACCOUNTANT: 'Accountant', DIRECTOR: 'Director', DEPARTMENT_HEAD: 'department heads' };

function Status({ item }: { item: HistoryItem }) {
  if (item.status === 'SCHEDULED') return <span className="font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Scheduled</span>;
  if (item.status === 'IN_FORCE') return <span className="font-wds-sans text-[12px] leading-4 text-wds-success-fg">In force now</span>;
  if (item.status === 'WITHDRAWN') return <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary line-through">Withdrawn</span>;
  return <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Replaced</span>;
}

/** Version history (Paper Chapter 13 step 12): every change to one tab, newest first, 25 to a page. */
export function HistoryScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = tabOfSlug(params.get('tab'));
  const siteId = params.get('site');
  const permissions = useWorkforcePermissions();
  const enabled = permissions.ready && permissions.can('rules.read');
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const remote = useRulesHistory(tab.group, siteId, page, perPage, enabled);
  const data = remote.data && !isLocked(remote.data) ? remote.data : null;
  const denied = (permissions.ready && !enabled) || (remote.status === 'error' && remote.error.status === 403);
  const scheduled = data?.items.find((i) => i.id === data.canWithdraw?.versionId);

  const chooseSite = (value: string): void => {
    setPage(1);
    router.replace(`/app/workforce/rules/history?tab=${tab.slug}${value ? `&site=${value}` : ''}`, { scroll: false });
  };
  const withdrawn = (): void => {
    useWdsToastStore.getState().addToast({ variant: 'success', title: 'Version withdrawn' });
    remote.reload();
  };

  return (
    <WorkforceFrame breadcrumb={{ section: 'Settings', screen: 'Rules', sectionHref: rulesHref(tab.slug, siteId) }} phoneTitle="Rules" label="Version history" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5">
        {denied ? (
          <ErrorBlock title="You do not have access to Rules" line="Ask the Director." />
        ) : (
          <>
            <Link href={rulesHref(tab.slug, siteId)} className={cn('w-fit font-wds-sans text-[13px] leading-4 text-wds-info-fg', FOCUS_RING, onHover('underline'))}>
              ← Back to Rules · {tab.title}
            </Link>
            <PageHeader size="lg" title={`${tab.title} · Version history`} subtitle="Every change is kept for ever. A payslip always uses the version that applied on the day." />
            {data && data.organizations.length > 1 ? (
              <div className="flex items-center gap-3">
                <span className="font-wds-sans text-[13px] text-wds-text-secondary">Site</span>
                <Picker aria-label="Site" value={data.organizationId ?? ''} onValueChange={chooseSite} options={data.organizations.map((o) => ({ value: o.organizationId ?? '', label: o.organizationName }))} className="h-9 w-[220px]" />
              </div>
            ) : null}
            {remote.status === 'loading' ? (
              <ListSkeleton rows={5} label="Loading the history" />
            ) : remote.status === 'error' ? (
              <ErrorBlock title="We could not load the history" line="Nothing was changed." reference={remote.error.code} onRetry={remote.reload} />
            ) : remote.data && isLocked(remote.data) ? (
              <Callout tone="neutral" variant="dashed">Statutory rates are shown to the Director, HR and the Accountant.</Callout>
            ) : data && data.items.length === 0 ? (
              <EmptyState kind="nothingYet" title="Nothing has been changed yet" line="The values are the starting values." />
            ) : data ? (
              <>
                <Table look="workforce" aria-label="Versions">
                  <TableHeader>
                    <TableRow>
                      <TableHead>VERSION</TableHead>
                      <TableHead>STARTS</TableHead>
                      <TableHead>CHANGED BY</TableHead>
                      <TableHead>WHAT CHANGED</TableHead>
                      <TableHead>TOLD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id} className={cn('h-14', item.status === 'SCHEDULED' && 'bg-[color-mix(in_oklab,var(--wds-caramel-100)_55%,white)]')}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">Version {item.version}</span>
                            <Status item={item} />
                          </div>
                        </TableCell>
                        <TableCell className="font-wds-mono">{longDay(item.effectiveFrom)}</TableCell>
                        <TableCell className="whitespace-normal">
                          {item.createdBy.name}, {ROLE_NAMES[item.createdBy.role] ?? item.createdBy.role} · {instantDay(item.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {item.changedSummary || 'Changed, see the audit log'}
                          <span className="block text-[12px] leading-4 text-wds-text-secondary">Why: {item.reason}</span>
                          {item.withdrawn ? (
                            <StatusTag tone="neutral" size="row">
                              Withdrawn by {item.withdrawn.by.name}, {ROLE_NAMES[item.withdrawn.by.role] ?? item.withdrawn.by.role}: {item.withdrawn.reason}
                            </StatusTag>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-normal">{andList(item.told.map((t) => TOLD_WORDS[t.role] ?? t.role))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePager page={data.page} perPage={data.pageSize} shown={data.items.length} total={data.total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
                {data.canWithdraw ? (
                  <Callout tone="neutral" variant="dashed" title="A scheduled version can still be withdrawn" action={<DialogButton kind="cancel" onClick={() => setWithdrawing(true)}>{`Withdraw version ${data.canWithdraw.version}`}</DialogButton>}>
                    {scheduled ? `Until ${longDay(scheduled.effectiveFrom)}` : 'Until it starts'} version {data.canWithdraw.version} can be cancelled. The withdrawal is logged and the same people are told.
                  </Callout>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
      {withdrawing && data?.canWithdraw ? <WithdrawDialog versionId={data.canWithdraw.versionId} version={data.canWithdraw.version} startsOn={scheduled?.effectiveFrom ?? null} onClose={() => setWithdrawing(false)} onDone={withdrawn} /> : null}
    </WorkforceFrame>
  );
}
