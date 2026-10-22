import * as React from 'react';

import { PanelReadOnlyTag, TitledPanel } from '../../../_shared/components/titled-panel';

/**
 * A card the viewer may not open (frame 12.1): a grey tag naming who may, a lock, and one sentence that says who does handle it, never
 * "kept from you". There is no number, no Show and no Edit here: the API sends nothing for it.
 */
export function RestrictedCard({ title, tag, line }: { title: string; tag: string; line: string }) {
  return (
    <TitledPanel title={title} aside={<PanelReadOnlyTag>{tag}</PanelReadOnlyTag>}>
      <p className="m-0 flex items-center gap-3 px-5 py-[22px] font-wds-sans text-[14px] leading-5 text-[#47433D]">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
          <rect x="5" y="11" width="14" height="9" fill="none" stroke="#847E76" strokeWidth="1.75" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#847E76" strokeWidth="1.75" />
        </svg>
        <span>{line}</span>
      </p>
    </TitledPanel>
  );
}

export const IDS_BANK_TAG = 'HR and Accountant only';
export const PAY_TAG = 'HR, Accountant and Director only';
export const IDS_BANK_RESTRICTED = 'Restricted. National ID, KRA PIN, NSSF, SHA and bank details are handled by HR and the Accountant.';
export const PAY_RESTRICTED = 'Restricted. Pay is handled by HR, the Accountant and the Director.';
