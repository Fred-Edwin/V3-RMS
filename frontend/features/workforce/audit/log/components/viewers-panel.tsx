'use client';

import { Panel, nameAndRole, useRemote } from '../../../_shared';
import { AUDIT_COPY, whenShort } from '../lib/audit-words';
import { auditReads } from '../services/audit-log-services';

/**
 * "Who looked at this log" (6a A5). Only the Director has it; the screen asks only when the access table says so, and a 404 draws nothing.
 * Names come with their role ("Anne Muthoni, Accountant"), never bare.
 */
export function ViewersPanel() {
  const viewers = useRemote(() => auditReads.viewers(), 'audit-viewers');
  if (viewers.status === 'error' && viewers.error.status === 404) return null;
  return (
    <Panel title="Who looked at this log" className="w-[300px] shrink-0 max-lg:w-full">
      {viewers.status === 'loading' ? (
        <p role="status" className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Loading…</p>
      ) : viewers.status === 'error' ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">We could not load this list.</p>
      ) : viewers.data.length === 0 ? (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{AUDIT_COPY.viewersNone}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {viewers.data.map((v) => (
            <li key={v.userId} className="flex items-baseline justify-between gap-3 border-b border-wds-neutral-100 py-2 last:border-b-0">
              <span className="min-w-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{nameAndRole(v.name, v.role)}</span>
              <span className="shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{whenShort(v.lastAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-0 mt-3 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{AUDIT_COPY.viewersNote}</p>
    </Panel>
  );
}
