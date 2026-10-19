import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, onHover } from '../../_shared';
import { andList } from '../lib/rules-words';
import { rulesHref } from '../lib/tab-defs';
import type { RulesPage } from '../types/rules-types';
import { SideLabel } from './who-panel';

/**
 * "SITES THAT DO THEIR OWN" (Lateness, Overtime, Leave). A viewer of the company rule sees which sites follow it and which have an own
 * rule (with a link to look at that site). A viewer of one site (a Branch Manager, or the Director looking at a site) sees that site's line,
 * and `backHref` leads the Director back to the company rule.
 */
export function SitesPanel({ page, slug, backHref }: { page: RulesPage; slug: string; backHref?: string }) {
  if (page.organizationId) {
    const own = page.sitesWithOwnRule.find((s) => s.organizationId === page.organizationId);
    return (
      <section aria-label="This site" className="flex flex-col gap-2">
        <SideLabel>THIS SITE</SideLabel>
        <div className="flex flex-col gap-2 border border-wds-border bg-wds-surface px-4 py-3">
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            {own ? `${page.organizationName} has its own rule: ${own.summary}` : `${page.organizationName} follows the company rule`}
          </span>
          {backHref ? (
            <Link href={backHref} className={cn('font-wds-sans text-[13px] leading-4 text-wds-info-fg', FOCUS_RING, onHover('underline'))}>
              Back to the company rule
            </Link>
          ) : null}
        </div>
      </section>
    );
  }
  const own = page.sitesWithOwnRule;
  const ownIds = new Set(own.map((s) => s.organizationId));
  const following = page.organizations.filter((s) => !ownIds.has(s.organizationId));
  if (page.organizations.length === 0) return null;
  return (
    <section aria-label="Sites that do their own" className="flex flex-col gap-2">
      <SideLabel>SITES THAT DO THEIR OWN</SideLabel>
      <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
        {following.length > 0 ? (
          <li className="flex items-baseline justify-between gap-4 border-t border-wds-neutral-100 px-4 py-3 first:border-t-0">
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{andList(following.map((s) => s.organizationName))}</span>
            <span className="shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Company rule</span>
          </li>
        ) : null}
        {own.map((s) => (
          <li key={s.organizationId} className="flex items-baseline justify-between gap-4 border-t border-wds-neutral-100 px-4 py-3 first:border-t-0">
            <Link href={rulesHref(slug, s.organizationId)} className={cn('font-wds-sans text-[13px] leading-[18px] text-wds-text-ink underline-offset-2', FOCUS_RING, onHover('underline'))}>
              {s.organizationName}
            </Link>
            <span className="text-right font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">Own rule · {s.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
