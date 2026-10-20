'use client';

import * as React from 'react';

import { FIELD_CLASS, PersonRadioList } from '../../../_shared';
import { conductReads } from '../../_shared/services/conduct-services';
import type { WitnessOption } from '../../_shared/types/conduct-types';

const DEBOUNCE_MS = 200;

/**
 * The witness (spec S11): a search over colleagues at the notice's site, never the issuer and never the person it is about, each with
 * their role. The list is a set of real radios, so the arrow keys move the choice. Pick one; the helper says they are asked to confirm.
 */
export function WitnessPicker({ noticeId, value, onChange, disabled }: { noticeId: string; value: string | null; onChange: (userId: string) => void; disabled: boolean }) {
  const [text, setText] = React.useState('');
  const [options, setOptions] = React.useState<WitnessOption[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      setFailed(false);
      conductReads.witnessOptions(noticeId, text.trim()).then(
        (rows) => !cancelled && setOptions(rows),
        () => !cancelled && setFailed(true)
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [noticeId, text]);

  return (
    <div className="flex flex-col gap-2.5">
      <input aria-label="Search for a witness" placeholder="Type a name" autoComplete="off" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} className={FIELD_CLASS} />
      {failed ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          The list did not load. Try typing again.
        </p>
      ) : options && options.length === 0 ? (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No one matches. Only colleagues at this site can be a witness.</p>
      ) : options ? (
        <PersonRadioList legend="WITNESS" people={options.map((o) => ({ value: o.userId, name: o.name, line: o.roleLabel }))} value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary" role="status">
          Loading colleagues…
        </p>
      )}
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The witness is asked to confirm on their phone.</p>
    </div>
  );
}
