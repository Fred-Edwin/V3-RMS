'use client';

import Link from 'next/link';

import { DialogButton, KeyValueRows } from '../../../_shared';
import { deskDocumentHref } from '../../_shared/lib/routes';
import type { DeskDetail } from '../../_shared/types/conduct-types';
import { detailRows, panelSubline, panelTitle, recordButton, withHrLine } from '../lib/desk-model';

/**
 * The detail beside the list (spec S8; Paper 1GB0-0 right): name and level, the number and who issued it, a 2 px ink rule, the key values,
 * and the buttons the server allows. "Open the notice" is outlined and always there for a notice with a letter; "Record that it was not
 * signed" is brown and shown only to the issuer or HR. A manager cannot decide an appeal, so an appealed notice says it is with HR.
 */
export function StandardPanel({ detail, now, onRecord, onChange }: { detail: DeskDetail; now: Date; onRecord: () => void; onChange: () => void }) {
  const record = recordButton(detail, now);
  const withHr = withHrLine(detail);
  const hasLetter = detail.level !== 'VERBAL_NOTE';
  return (
    <div className="flex flex-col gap-5 p-[22px]">
      <header className="flex flex-col gap-1">
        <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">{panelTitle(detail)}</h2>
        <p className="m-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{panelSubline(detail)}</p>
      </header>
      <KeyValueRows rows={detailRows(detail)} aria-label="About this notice" className="border-t-2" />
      {detail.verbalLine ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{detail.verbalLine}</p> : null}
      {detail.facts ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">The manager's own line: {detail.ownLine}</p> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {record.show ? (
          <DialogButton kind="primary" size="lg" onClick={onRecord} disabled={!record.enabled} aria-describedby={record.reason ? 'record-reason' : undefined}>
            Record that it was not signed
          </DialogButton>
        ) : null}
        {detail.actions.canChange ? (
          <DialogButton kind="cancel" size="lg" onClick={onChange}>
            Change this notice
          </DialogButton>
        ) : null}
        {hasLetter ? (
          <Link
            href={deskDocumentHref(detail.id)}
            className="inline-flex h-[38px] items-center border border-wds-border-strong px-5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring [@media(hover:hover)_and_(pointer:fine)]:hover:bg-wds-neutral-50"
          >
            Open the notice
          </Link>
        ) : null}
      </div>
      {record.show && record.reason ? (
        <p id="record-reason" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {record.reason}
        </p>
      ) : null}
      {withHr ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{withHr}</p> : null}
    </div>
  );
}
