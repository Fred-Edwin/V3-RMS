'use client';

import * as React from 'react';

import type { PendingEdit } from '../_shared/hooks/use-rota-editor';
import { changeLines } from '../_shared/lib/rota-edits';
import type { WeekView } from '../_shared/types/rota-types';
import { LeaveOverrideDialog } from './leave-override-dialog';
import { NearTermReasonDialog } from './near-term-reason-dialog';

/** The two questions an edit can stop to ask: a leave override first (step 4), then a reason for today or tomorrow (step 5). */
export function PendingDialogs({ week, pending, answer, cancel }: { week: WeekView; pending: PendingEdit | null; answer: (text: string) => Promise<void>; cancel: () => void }) {
  if (!pending) return null;
  if (pending.stage === 'leave') {
    return <LeaveOverrideDialog cells={pending.gate.leaveCells} busy={pending.busy} error={pending.error} onConfirm={(r) => void answer(r)} onCancel={cancel} />;
  }
  const templates = new Map(week.templates.map((t) => [t.id, t] as const));
  return <NearTermReasonDialog lines={changeLines(week, pending.edit.changes, templates)} busy={pending.busy} error={pending.error} onConfirm={(r) => void answer(r)} onCancel={cancel} />;
}
