'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import type { EmployeeFile } from '../../_shared/types/people-types';
import { lastFour } from '../lib/own-numbers';
import { OwnCard } from './own-file-cards';

interface Field {
  key: string;
  label: string;
  secret: boolean;
  /** Numbers are drawn in the mono face; the bank's name is words. */
  mono: boolean;
}

const ROWS: readonly (readonly Field[])[] = [
  [
    { key: 'nationalId', label: 'National ID', secret: true, mono: true },
    { key: 'kraPin', label: 'KRA PIN', secret: true, mono: true },
  ],
  [
    { key: 'nssfNumber', label: 'NSSF number', secret: true, mono: true },
    { key: 'shaNumber', label: 'SHA number', secret: true, mono: true },
  ],
  [
    { key: 'bankName', label: 'Bank', secret: false, mono: false },
    { key: 'accountNumber', label: 'Account number', secret: true, mono: true },
  ],
];
const HELB: Field = { key: 'helbNumber', label: 'HELB number', secret: true, mono: true };

/** Show and Edit: amber, underlined, 14 px medium, a 44 px tall target (frame 8.2). */
const LINK = 'flex h-11 items-center justify-center border-0 bg-transparent font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring';

/**
 * IDs and bank on My file (frames 8.1 to 8.3): two columns, only the last four characters, one Show for the whole card and an Edit. The
 * person's own file arrives in clear, so Show is local: it opens nothing on the server and writes no audit entry. The screen reader
 * hears "ends in 5678" for a hidden number, never the dots. HELB has no place in the frame, so it appears only when one is on file.
 */
export function OwnIdsCard({ file, onEdit }: { file: Pick<EmployeeFile, 'sensitive'>; onEdit: () => void }) {
  const [shown, setShown] = React.useState(false);
  const values = file.sensitive;
  const rows: readonly (readonly Field[])[] = values[HELB.key] ? [...ROWS, [HELB]] : ROWS;
  return (
    <OwnCard
      title="IDs and bank"
      aside={
        <span className="flex items-center">
          <button type="button" aria-pressed={shown} aria-label={shown ? 'Hide my numbers' : 'Show my numbers'} onClick={() => setShown((s) => !s)} className={cn(LINK, 'min-w-14')}>
            {shown ? 'Hide' : 'Show'}
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit my IDs and bank" className={cn(LINK, 'min-w-12')}>
            Edit
          </button>
        </span>
      }
    >
      {rows.map((row) => (
        <dl key={row[0]?.key} className="m-0 flex min-h-16 items-center gap-4 border-t border-wds-border px-[18px]">
          {row.map((f) => {
            const raw = values[f.key] ?? null;
            const text = raw === null || raw === '' ? 'Not on file' : f.secret && !shown ? lastFour(raw) : raw;
            return (
              <div key={f.key} className="flex w-[152px] min-w-0 shrink flex-col gap-1">
                <dt className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{f.label}</dt>
                <dd
                  className={cn('m-0 truncate text-[14px] leading-[18px] text-wds-text-ink', f.mono ? 'font-wds-mono' : 'font-wds-sans')}
                  aria-label={f.secret && !shown && raw ? `${f.label}, ends in ${raw.replace(/\s+/g, '').slice(-4)}` : undefined}
                >
                  {text}
                </dd>
              </div>
            );
          })}
        </dl>
      ))}
    </OwnCard>
  );
}
