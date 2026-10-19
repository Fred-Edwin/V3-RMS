import * as React from 'react';

import { cn } from '@/lib/cn';

import { ROLE_NAMES } from '../lib/rules-words';
import type { AccessTableRow } from '../types/rules-types';

const ROLES = ['DIRECTOR', 'BRANCH_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN'] as const;

export interface WhoEntry {
  role: string;
  text: string;
  tone: 'may' | 'read';
}

/** The panel's lines, from the server's "Who edits what" row for the tab, so they cannot disagree with the padlocks. */
export function whoEntries(access: AccessTableRow | null, rowTitles: Record<string, string>, siteGroup: boolean): WhoEntry[] {
  if (!access) return [];
  const entries: WhoEntry[] = [];
  for (const role of ROLES) {
    const change = access.changedBy.find((c) => c.role === role);
    const confirm = access.confirmedBy.find((c) => c.role === role);
    const label = role === 'HR_MANAGER' ? 'HR Manager' : (ROLE_NAMES[role] ?? role);
    if (change) {
      const ids = Object.keys(rowTitles);
      const left = ids.filter((id) => !change.rows?.includes(id));
      const what = change.rows === null ? 'Everything' : left.length > 0 && left.length <= 2 && change.rows.length > left.length ? `All but ${left.map((id) => rowTitles[id]).join(', ')}` : change.rows.map((id) => rowTitles[id] ?? id).join(', ');
      const where = change.scope === 'OWN_SITE' ? 'own site' : siteGroup ? 'any site' : 'company only';
      entries.push({ role: label, text: `${what}: ${where}`, tone: 'may' });
    } else if (confirm) {
      entries.push({ role: label, text: confirm.what ? `Confirms ${confirm.what}` : 'Confirms the change', tone: 'may' });
    } else if (role !== 'SYSTEM_ADMIN') {
      entries.push({ role: label, text: 'Read only', tone: 'read' });
    }
  }
  return entries;
}

/** Short names for the panel's lines, from the editable rows' `thing` ("the grace period" becomes "grace period"). */
export const rowNames = (defs: readonly { id: string; thing: string; Editor?: unknown }[]): Record<string, string> =>
  Object.fromEntries(defs.filter((d) => d.Editor).map((d) => [d.id, d.thing.replace(/^the /, '')]));

/** Right-hand "WHO CHANGES IT" panel (Spec section 1). */
export function WhoPanel({ title = 'WHO CHANGES IT', entries }: { title?: string; entries: WhoEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{title}</h3>
      <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
        {entries.map((e) => (
          <li key={e.role} className="flex items-baseline justify-between gap-4 border-t border-wds-neutral-100 px-4 py-3 first:border-t-0">
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{e.role}</span>
            <span className={cn('text-right font-wds-sans text-[13px] leading-4', e.tone === 'may' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The mono label over a right-hand panel or card. */
export function SideLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{children}</h3>;
}

/** Two columns: the rows on the left, the notes on the right; they stack under 1100 px. */
export function TabColumns({ left, right, leftWidth = 720 }: { left: React.ReactNode; right: React.ReactNode; leftWidth?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,var(--left))_minmax(320px,420px)]" style={{ ['--left' as string]: `${leftWidth}px` }}>
      <div className="flex min-w-0 flex-col gap-4">{left}</div>
      <div className="flex min-w-0 flex-col gap-4">{right}</div>
    </div>
  );
}
