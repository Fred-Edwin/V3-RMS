'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';

import { Callout, ErrorBlock, FOCUS_RING, ListSkeleton, MOTION, PageHeader, UnderlineTabs, WorkforceFrame, onHover, STATES_COPY, useStillLoading, useWorkforcePermissions } from '../../_shared';
import { useAccessTable, useOnline, useRulesPage } from '../hooks/use-rules-data';
import { longDay } from '../lib/rules-words';
import { greyLine } from '../lib/tab-copy';
import { historyHref, rulesHref, SITE_GROUPS, tabOfSlug, TABS, WHO_EDITS_HREF } from '../lib/tab-defs';
import { TabBody } from '../tabs/tab-body';
import { isLocked, type SavedVersion } from '../types/rules-types';
import { PendingBanners, ScheduledBanner } from './status-banners';

const outlined = cn('inline-flex h-[34px] items-center border border-wds-border-strong bg-transparent px-4 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));

/** Rules (Paper Chapters 10 and 13): the ten tabs. Every button follows the server's answer for this person, never a role name. */
export function RulesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = tabOfSlug(params.get('tab'));
  const siteParam = SITE_GROUPS.includes(tab.group) ? params.get('site') : null;
  const permissions = useWorkforcePermissions();
  const allowed = permissions.can('rules.read');
  const enabled = permissions.ready && allowed;
  const page = useRulesPage(tab.group, siteParam, enabled);
  const access = useAccessTable(enabled);
  const online = useOnline();
  const viewerRole = useAuthStore((s) => s.user?.role ?? null);
  const slow = useStillLoading(page.status === 'loading');

  const open = (slug: string): void => {
    const target = tabOfSlug(slug);
    router.replace(rulesHref(slug, SITE_GROUPS.includes(target.group) ? params.get('site') : null), { scroll: false });
  };
  const saved = (s: SavedVersion): void => {
    useWdsToastStore.getState().addToast({ variant: 'success', title: `Saved as version ${s.version.version}, from ${longDay(s.version.effectiveFrom)}` });
    page.reload();
  };

  const denied = (permissions.ready && !allowed) || (page.status === 'error' && page.error.status === 403);
  const data = page.data;
  const live = data && !isLocked(data) ? data : null;
  const row = access.data?.rows.find((r) => r.group === tab.group) ?? null;
  const title = `Rules · ${tab.title}${live?.organizationName ? ` · ${live.organizationName}` : ''}`;

  return (
    <WorkforceFrame breadcrumb={{ section: 'Settings', screen: 'Rules' }} phoneTitle="Rules" label="Rules" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5">
        {denied ? (
          <ErrorBlock title="You do not have access to Rules" line="Ask the Director." />
        ) : (
          <>
            <PageHeader
              size="lg"
              title={title}
              subtitle={live ? greyLine(live) : undefined}
              actions={data && !isLocked(data) ? <Link href={historyHref(tab.slug, siteParam)} className={outlined}>Version history</Link> : undefined}
            />
            <UnderlineTabs label="Rule groups" items={TABS.map((t) => ({ value: t.slug, label: t.label }))} value={tab.slug} onChange={open} />
            {!online ? <Callout tone="warning" size="sm" role="status">No connection. You can read the rules; Change comes back when the connection does.</Callout> : null}
            <div role="tabpanel" aria-label={tab.label} className="flex flex-col gap-4">
              {page.status === 'loading' ? (
                <>
                  <ListSkeleton rows={5} label="Loading the rules" />
                  {slow ? <p role="status" className="m-0 font-wds-sans text-[13px] text-wds-text-secondary">Still loading. This is taking longer than usual.</p> : null}
                </>
              ) : page.status === 'error' ? (
                <ErrorBlock title={`We could not load ${tab.label.toLowerCase()}`} line={page.error.status === 404 ? 'That site was not found.' : STATES_COPY.rules.error} reference={page.error.code} onRetry={page.reload} />
              ) : data && isLocked(data) ? (
                <Callout tone="neutral" variant="dashed" title="Statutory rates are not shown to you">Statutory rates are shown to the Director, HR and the Accountant.</Callout>
              ) : live ? (
                <>
                  <ScheduledBanner page={live} slug={tab.slug} />
                  <PendingBanners page={live} viewerRole={viewerRole} onDone={page.reload} />
                  <TabBody page={live} access={row} onSaved={saved} onStale={page.reload} reload={page.reload} backHref={siteParam ? rulesHref(tab.slug) : undefined} />
                </>
              ) : null}
            </div>
            <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              <Link href={WHO_EDITS_HREF} className={cn('text-wds-info-fg', FOCUS_RING, onHover('underline'))}>Who edits what</Link>
            </p>
          </>
        )}
      </div>
    </WorkforceFrame>
  );
}
