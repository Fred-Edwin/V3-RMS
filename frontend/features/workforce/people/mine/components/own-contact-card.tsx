'use client';

import * as React from 'react';

import type { EmployeeFile } from '../../_shared/types/people-types';
import { OwnCard } from './own-file-cards';

/** The blue note under IDs and bank (frame 8.2): 12/17 text on a pale blue ground. */
export function OwnInfoNote({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border border-[#C1D4DF] bg-[#ECF2F5] px-[18px] py-3.5 font-wds-sans text-[12px] leading-[17px] text-[#2C5670]">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center border-t border-wds-border px-[18px]">
      <span className="w-[124px] shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{label}</span>
      {children}
    </div>
  );
}

/** "Your contact": the person's phone and the emergency contact. Edit opens the contact form. */
export function OwnContactCard({ file, onEdit }: { file: Pick<EmployeeFile, 'personalPhone' | 'emergencyContact'>; onEdit: () => void }) {
  const emergency = file.emergencyContact;
  return (
    <OwnCard
      title="Your contact"
      aside={
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit my contact"
          className="flex h-11 min-w-12 items-center justify-center border-0 bg-transparent font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring"
        >
          Edit
        </button>
      }
    >
      <Row label="Phone">
        <span className={file.personalPhone ? 'font-wds-mono text-[14px] leading-[18px] text-wds-text-ink' : 'font-wds-sans text-[14px] leading-[18px] text-[#8D8982]'}>{file.personalPhone ?? 'Not added yet'}</span>
      </Row>
      <Row label="Emergency">
        {emergency ? (
          <span className="flex min-w-0 flex-col gap-px">
            <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{[emergency.name, emergency.relation].filter(Boolean).join(' · ')}</span>
            <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{emergency.phone}</span>
          </span>
        ) : (
          <span className="font-wds-sans text-[14px] leading-[18px] text-[#8D8982]">Not added yet</span>
        )}
      </Row>
    </OwnCard>
  );
}

/** The dark confirmation bar at the foot of the phone (frame 8.2): an amber dot and one line. It leaves by itself after a few seconds. */
export function SavedBar({ message, onGone }: { message: string; onGone: () => void }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  React.useEffect(() => {
    // The row that opened a form may be gone once it is saved, so focus would fall to the page; put it on the confirmation.
    ref.current?.focus();
    const t = window.setTimeout(onGone, 6000);
    return () => window.clearTimeout(t);
  }, [message, onGone]);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="fixed inset-x-4 bottom-4 z-30 m-0 flex h-12 items-center gap-2.5 bg-[#171512] px-[18px] font-wds-sans text-[14px] leading-[18px] text-[#F5F3EF] shadow-[0_8px_24px_#17151240] outline-none"
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded bg-[#D9A65E]" />
      {message}
    </p>
  );
}
