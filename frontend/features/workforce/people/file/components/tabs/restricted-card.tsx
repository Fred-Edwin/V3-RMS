import * as React from 'react';

import { TitledPanel } from '../../../_shared/components/titled-panel';

/**
 * A card the viewer may not open (frame 12.1). It says who does handle it, never "kept from you". There is no number, no Show and no
 * Edit here: the API sends nothing for it.
 */
export function RestrictedCard({ title, line }: { title: string; line: string }) {
  return (
    <TitledPanel title={title}>
      <p className="m-0 flex items-start gap-2.5 px-4 py-4 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
        <span aria-hidden className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border border-wds-border-strong" />
        <span>{line}</span>
      </p>
    </TitledPanel>
  );
}

export const IDS_BANK_RESTRICTED = 'Restricted. IDs and bank details are handled by HR and the Accountant.';
export const PAY_RESTRICTED = 'Restricted. Pay is handled by HR, the Accountant and the Director.';
