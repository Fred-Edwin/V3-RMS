'use client';

import * as React from 'react';

import { KENYAN_BANKS, OTHER_BANK } from '../../_shared/lib/kenyan-banks';
import { onFileEnding } from '../../_shared/lib/statutory-formats';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogDigits, DialogError, DialogPicker, DialogText } from '../../file/components/dialogs/dialog-fields';
import { useOwnNumbers } from '../hooks/use-own-numbers';
import { OwnInfoNote } from './own-contact-card';
import { OwnButton, OwnPage } from './own-page';

/**
 * Your ID and bank on a phone (frame 8.3): a full page with 44 px fields, "On file, ends 8905" under each number, the note that the
 * Accountant is told, one brown button and a line about the audit log. Numbers use the in-app pad; KRA PIN and NSSF/SHA keep letters.
 * Frame 8.3 draws four fields; NSSF, SHA and HELB follow KRA PIN because the person may change those too (owner decision, 22 Oct).
 */
export function OwnNumbersPage({ file, onClose, done }: { file: Pick<EmployeeFile, 'sensitive'>; onClose: () => void; done: (message: string) => void }) {
  const n = useOwnNumbers(file, done);
  const { form, set, errors, shown } = n;
  const ending = (key: string): string | undefined => onFileEnding(file.sensitive[key]) ?? undefined;
  const bankValue = n.otherBank ? OTHER_BANK : form.bankName;
  return (
    <OwnPage kicker="MY FILE" title="Your ID and bank" subtitle="Change what is wrong. It saves straight away. Only you and HR can see these." onBack={onClose} backLabel="Back to My file">
      <DialogDigits tall label="National ID" maxLength={20} value={form.nationalId} onChange={(v) => set({ nationalId: v })} helper={ending('nationalId')} error={shown ? errors.nationalId : undefined} />
      <DialogText tall mono label="KRA PIN" value={form.kraPin} onChange={(v) => set({ kraPin: v.toUpperCase() })} helper={ending('kraPin')} error={shown ? errors.kraPin : undefined} />
      <DialogText tall mono label="NSSF number" value={form.nssfNumber} onChange={(v) => set({ nssfNumber: v })} helper={ending('nssfNumber')} error={shown ? errors.nssfNumber : undefined} />
      <DialogText tall mono label="SHA number" value={form.shaNumber} onChange={(v) => set({ shaNumber: v })} helper={ending('shaNumber')} error={shown ? errors.shaNumber : undefined} />
      <DialogText tall mono label="HELB number" hint="optional" value={form.helbNumber} onChange={(v) => set({ helbNumber: v })} />
      <DialogPicker
        tall
        label="Bank"
        value={bankValue}
        placeholder="Choose your bank"
        options={[...KENYAN_BANKS, OTHER_BANK].map((b) => ({ value: b, label: b }))}
        onChange={(v) => {
          n.setOtherBank(v === OTHER_BANK);
          set({ bankName: v === OTHER_BANK ? '' : v });
        }}
        error={shown ? errors.bankName : undefined}
      />
      {n.otherBank ? <DialogText tall label="Name of your bank" value={form.bankName} onChange={(v) => set({ bankName: v })} /> : null}
      <DialogDigits tall label="Account number" maxLength={20} value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} helper={ending('accountNumber')} error={shown ? errors.accountNumber : undefined} />
      <OwnInfoNote>The Accountant will be told when you change your bank or account.</OwnInfoNote>
      <DialogError message={n.error} />
      <OwnButton onClick={n.save} disabled={n.busy || !n.changed}>{n.busy ? 'Saving…' : 'Save changes'}</OwnButton>
      <p className="m-0 text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Saving updates your file at once. The change is written to the audit log.</p>
    </OwnPage>
  );
}
