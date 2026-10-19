'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { Callout, DialogButton, FOCUS_RING, onHover } from '../../_shared';
import { historyHref } from '../lib/tab-defs';
import { longDay, orList, roleInSentence, unique } from '../lib/rules-words';
import type { PendingConfirmation, RulesPage } from '../types/rules-types';
import { ConfirmDialog, nounOf } from './confirm-dialog';

/** Amber line above the rows: a version that has not started yet. The rows keep showing today's values. */
export function ScheduledBanner({ page, slug }: { page: RulesPage; slug: string }) {
  if (!page.scheduled) return null;
  const s = page.scheduled;
  return (
    <Callout tone="warning" size="sm" role="status">
      Version {s.version} starts on {longDay(s.effectiveFrom)}
      {s.changedSummary ? ` (${s.changedSummary})` : ''}.{' '}
      <Link href={historyHref(slug, page.organizationId)} className={cn('underline underline-offset-2', FOCUS_RING, onHover('opacity-80'))}>
        View it
      </Link>
    </Callout>
  );
}

/** A pay value that waits for someone to confirm it. The old confirmed value stays in use until then (D2); no figures are shown (D1). */
export function PendingBanners({ page, viewerRole, onDone }: { page: RulesPage; viewerRole: string | null; onDone: () => void }) {
  const [confirming, setConfirming] = React.useState<PendingConfirmation | null>(null);
  if (page.pendingConfirmations.length === 0) return null;
  return (
    <>
      {page.pendingConfirmations.map((p) => {
        const who = orList(unique(p.whoCan.map((w) => roleInSentence(w.role))));
        const mayConfirm = viewerRole !== null && p.whoCan.some((w) => w.role === viewerRole);
        return (
          <Callout
            key={`${p.versionId}:${p.scope}`}
            tone="warning"
            size="sm"
            role="status"
            title={`A new ${nounOf(p.scope)} waits for ${who}`}
            action={mayConfirm ? <DialogButton kind="cancel" onClick={() => setConfirming(p)}>Confirm</DialogButton> : undefined}
            actionAt="end"
          >
            Version {p.version}, {p.inForce ? 'already due' : `from ${longDay(p.effectiveFrom)}`}. Until it is confirmed the old one stays in use.
          </Callout>
        );
      })}
      {confirming ? <ConfirmDialog pending={confirming} onClose={() => setConfirming(null)} onDone={onDone} /> : null}
    </>
  );
}
