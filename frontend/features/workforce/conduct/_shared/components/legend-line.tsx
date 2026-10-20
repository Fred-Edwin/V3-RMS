'use client';

import * as React from 'react';

import { STATUS_HELP } from '../lib/conduct-words';

/**
 * The status reference as help text (spec section 4): Paper draws Chapter 11 step 13 as a table; the build turns it into a small
 * "What do the statuses mean?" disclosure under the list. It opens with Enter or Space, and each row is a term and what it means.
 */
export function LegendLine() {
  return (
    <details className="group mt-3 border border-wds-border bg-wds-surface px-4 py-3">
      <summary className="cursor-pointer list-none font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
        <span aria-hidden className="mr-2 text-wds-text-faint group-open:hidden">+</span>
        <span aria-hidden className="mr-2 hidden text-wds-text-faint group-open:inline">−</span>
        What do the statuses mean?
      </summary>
      <dl className="m-0 mt-3 flex flex-col gap-3">
        {STATUS_HELP.map((row) => (
          <div key={row.word} className="flex flex-col gap-0.5">
            <dt className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{row.word}</dt>
            <dd className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">
              {row.means} {row.next}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-3 font-wds-sans text-[12px] leading-4 text-wds-text-faint">The end dates are set in Rules.</p>
    </details>
  );
}
