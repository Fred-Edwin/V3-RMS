'use client';

import * as React from 'react';

import { useWdsToastStore } from '@/store/wdsToastStore';

import { DialogButton, ErrorBlock, KeyValueRows, ListSkeleton, Panel, nameAndRole, type KeyValueRow, type Remote } from '../../../_shared';
import { DOCUMENTS_COPY, dateTime, panelKicker, statusLine } from '../lib/documents-words';
import type { DocumentPanelData } from '../types/documents-types';

function rowsOf(p: DocumentPanelData): KeyValueRow[] {
  const rows: KeyValueRow[] = [{ label: 'Approved by', value: `${nameAndRole(p.approvedBy.name, p.approvedBy.role)}, ${dateTime(p.approvedBy.at)}` }];
  if (p.reviewedBy) rows.push({ label: 'Reviewed by', value: `${nameAndRole(p.reviewedBy.name, p.reviewedBy.role)}, ${dateTime(p.reviewedBy.at)}` });
  rows.push({ label: 'Signed with', value: p.method });
  if (p.siteName) rows.push({ label: 'Site', value: p.siteName });
  if (p.forPerson) rows.push({ label: 'For', value: nameAndRole(p.forPerson.name, p.forPerson.role) });
  return rows;
}

async function copy(text: string): Promise<void> {
  const toast = useWdsToastStore.getState();
  try {
    await navigator.clipboard.writeText(text);
    toast.addToast({ variant: 'success', title: DOCUMENTS_COPY.linkCopied });
  } catch {
    toast.addToast({ variant: 'error', title: DOCUMENTS_COPY.linkFailed });
  }
}

/**
 * The chosen document (6c D2, right panel): who approved, who reviewed, how it was signed, and the buttons. Open document is replaced by
 * a plain line once the document is archived. Copy link copies the address the QR opens. Opening is audited by the API.
 */
export function DocumentPanel({ panel, onOpen, onClose }: { panel: Remote<DocumentPanelData | null>; onOpen: (p: DocumentPanelData) => void; onClose: () => void }) {
  let body: React.ReactNode;
  if (panel.status === 'loading') body = <ListSkeleton rows={4} columns={[80, 'fill']} label="Loading the document" />;
  else if (panel.status === 'error' && !panel.data) {
    const gone = panel.error.status === 404;
    body = <ErrorBlock title={gone ? 'We could not find that document.' : DOCUMENTS_COPY.error} line={gone ? 'It may be outside what you can read.' : DOCUMENTS_COPY.errorLine} onRetry={gone ? undefined : panel.reload} reference={gone ? undefined : panel.error.code} />;
  } else if (panel.data) {
    const p = panel.data;
    const line = statusLine(p);
    body = (
      <div className="flex flex-col gap-3">
        <p className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{panelKicker(p)}</p>
        <h3 className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">{p.title} · {p.about}</h3>
        {line ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{line}</p> : null}
        <KeyValueRows rows={rowsOf(p)} aria-label="Signatures" />
        <div className="flex flex-wrap gap-2">
          {p.openHref ? <DialogButton kind="primary" size="lg" onClick={() => onOpen(p)}>Open document</DialogButton> : <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{DOCUMENTS_COPY.archived}</p>}
          <DialogButton kind="cancel" size="lg" onClick={() => void copy(p.verifyUrl)}>Copy link</DialogButton>
        </div>
        <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{DOCUMENTS_COPY.retention}</p>
      </div>
    );
  }
  return (
    <aside aria-label={panel.data ? `Document ${panel.data.number}` : 'Document'} className="w-[320px] shrink-0 max-lg:w-full">
      <Panel title="Document" caption="ESC TO CLOSE" className="sticky top-0">
        <div onKeyDown={(e) => e.key === 'Escape' && onClose()}>{body}</div>
      </Panel>
    </aside>
  );
}
