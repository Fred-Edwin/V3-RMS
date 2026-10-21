'use client';

import * as React from 'react';

import { TitledPanel } from '../../_shared/components/titled-panel';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { lastFour } from '../lib/own-numbers';

const FIELDS: readonly { key: string; label: string; secret: boolean }[] = [
  { key: 'nationalId', label: 'National ID', secret: true },
  { key: 'kraPin', label: 'KRA PIN', secret: true },
  { key: 'nssfNumber', label: 'NSSF number', secret: true },
  { key: 'shaNumber', label: 'SHA number', secret: true },
  { key: 'helbNumber', label: 'HELB number', secret: true },
  { key: 'bankName', label: 'Bank', secret: false },
  { key: 'accountNumber', label: 'Account number', secret: true },
];

const LINK = 'flex min-h-11 items-center border-0 bg-transparent px-1 font-wds-sans text-[14px] leading-[18px] outline-none focus-visible:shadow-wds-ring';

/**
 * IDs and bank on My file (frames 8.1 to 8.3): two columns, only the last four digits, one Show for the whole card and an amber
 * underlined Edit. The person's own file arrives in clear, so Show is local: it opens nothing on the server and writes no audit entry.
 * The screen reader hears "ends in 5678" for a hidden number, never the dots.
 */
export function OwnIdsCard({ file, onEdit }: { file: Pick<EmployeeFile, 'sensitive'>; onEdit: () => void }) {
  const [shown, setShown] = React.useState(false);
  const values = file.sensitive;
  return (
    <TitledPanel
      title="IDs and bank"
      aside={
        <span className="flex items-center gap-2">
          <button type="button" aria-pressed={shown} aria-label={shown ? 'Hide my numbers' : 'Show my numbers'} onClick={() => setShown((s) => !s)} className={`${LINK} text-wds-primary hover:underline`}>
            {shown ? 'Hide' : 'Show'}
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit my IDs and bank" className={`${LINK} text-[#A8680A] underline underline-offset-2`}>
            Edit
          </button>
        </span>
      }
    >
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-4 px-[18px] py-4">
        {FIELDS.map((f) => {
          const raw = values[f.key] ?? null;
          const text = raw === null || raw === '' ? 'Not on file' : f.secret && !shown ? lastFour(raw) : raw;
          return (
            <div key={f.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{f.label}</dt>
              <dd className="m-0 truncate font-wds-mono text-[14px] leading-5 text-wds-text-ink" aria-label={f.secret && !shown && raw ? `${f.label}, ends in ${raw.replace(/\s+/g, '').slice(-4)}` : undefined}>
                {text}
              </dd>
            </div>
          );
        })}
      </dl>
    </TitledPanel>
  );
}
