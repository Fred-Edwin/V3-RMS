'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { TitledPanel, PanelReadOnlyTag, PanelLink } from '../../../_shared/components/titled-panel';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { useReveal } from '../../hooks/use-reveal';
import { sensitiveRows } from '../../lib/sensitive-fields';

/**
 * IDs and bank on the Job and pay tab: masked ("•••• 5678"), with a "Show" button that asks the server, which writes the opening to
 * the audit log. The clear value stays for 30 seconds, or until "Hide". A person's own file is `mine/components/own-ids-card.tsx`.
 */
export function SensitivePanel({ file, onEdit }: { file: EmployeeFile; onEdit?: () => void }) {
  const reveal = useReveal(file.id);
  const rows = sensitiveRows(file);
  if (rows.length === 0) return null;
  // "Edit" (amber, underlined) when the viewer may change anything on the card; otherwise the grey tag in the same place.
  const aside = onEdit ? <PanelLink onClick={onEdit}>Edit</PanelLink> : <PanelReadOnlyTag>Every opening is logged</PanelReadOnlyTag>;
  return (
    <TitledPanel title="IDs and bank" aside={aside}>
      <dl className="m-0 flex flex-col px-5 pb-2 pt-1">
        {rows.map((r) => {
          const clear = r.key in reveal.shown;
          return (
            <div key={r.key} className="flex h-12 items-center border-b border-wds-border last:border-b-0">
              <dt className="w-[150px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.label}</dt>
              <dd className="m-0 flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className={cn('font-wds-mono text-[14px] leading-[18px]', r.masked ? 'text-wds-text-ink' : 'font-wds-sans text-wds-text-secondary')} aria-live="polite">
                  {clear ? (reveal.shown[r.key] ?? 'Not on file') : (r.masked ?? 'Not on file')}
                </span>
                {r.canReveal ? (
                  <button
                    type="button"
                    disabled={reveal.busy === r.key}
                    aria-label={`${clear ? 'Hide' : 'Show'} ${r.label}`}
                    onClick={() => (clear ? reveal.hide(r.key) : void reveal.show(r.key))}
                    className="min-w-10 border-0 bg-transparent p-0 text-right font-wds-sans text-[13px] font-medium leading-4 text-[#A8680A] underline underline-offset-2 outline-none focus-visible:shadow-wds-ring disabled:opacity-60"
                  >
                    {reveal.busy === r.key ? '…' : clear ? 'Hide' : 'Show'}
                  </button>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      {reveal.error ? (
        <p role="alert" className="m-0 border-t border-wds-border px-4 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {reveal.error}
        </p>
      ) : null}
    </TitledPanel>
  );
}
