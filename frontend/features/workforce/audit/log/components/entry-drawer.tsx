'use client';

import * as React from 'react';

import { Callout, DialogButton, ErrorBlock, KeyValueRows, ListSkeleton, Panel, StatusTag, WorkforceDrawer, type KeyValueRow } from '../../../_shared';
import { useChainCheck, useEntryDetail } from '../hooks/use-audit-actions';
import { AUDIT_COPY, entryNumber, kickerOf, shortHash, whenLong, whoLine } from '../lib/audit-words';
import { changeRows } from '../lib/change-rows';
import type { AuditDetail } from '../types/audit-log-types';

function detailRows(e: AuditDetail): KeyValueRow[] {
  const rows: KeyValueRow[] = [
    { label: 'When', value: whenLong(e.occurredAt), mono: true },
    { label: 'Who', value: whoLine(e) },
  ];
  if (e.siteName) rows.push({ label: 'Site', value: e.siteName });
  if (e.subjectUser) rows.push({ label: 'About', value: e.subjectUser.name });
  if (e.reason) rows.push({ label: 'Reason', value: e.reason });
  // The server leaves these out for readers without the right; the drawer only draws what it was given.
  if (e.deviceLabel) rows.push({ label: 'Phone', value: e.deviceLabel });
  if (e.placeLabel) rows.push({ label: 'Place', value: `${e.placeLabel} (approximate)` });
  return rows;
}

function ChainLine({ state }: { state: ReturnType<typeof useChainCheck>['state'] }) {
  if (state.status === 'running') return <p role="status" className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Checking…</p>;
  if (state.status === 'intact') return <Callout tone="success" role="status">Chain intact from entry 1 to {entryNumber(state.toSeq)}.</Callout>;
  if (state.status === 'broken') return <Callout tone="error" role="alert">Entry {entryNumber(state.seq)} does not match the one before it. The System Admin has been told.</Callout>;
  if (state.status === 'wait') return <Callout tone="warning" role="status">The chain can be checked once a minute. Wait a moment, then try again.</Callout>;
  if (state.status === 'failed') return <Callout tone="error" role="alert">{state.message}</Callout>;
  return null;
}

function Body({ id, canCheck }: { id: string; canCheck: boolean }) {
  const detail = useEntryDetail(id);
  const chain = useChainCheck();
  if (detail.status === 'loading') return <ListSkeleton rows={4} columns={[80, 'fill']} label="Loading the entry" />;
  if (detail.status === 'error' || !detail.data) {
    // 404 means gone or out of reach; the API gives no hint which.
    const missing = detail.status === 'error' && detail.error.status === 404;
    return <ErrorBlock title={missing ? AUDIT_COPY.drawerMissing : AUDIT_COPY.loadError} line={missing ? 'It may be outside what you can read.' : AUDIT_COPY.loadErrorLine} onRetry={missing ? undefined : detail.reload} reference={missing ? undefined : detail.status === 'error' ? detail.error.code : undefined} />;
  }
  const e = detail.data;
  const changes = changeRows(e.before, e.after);
  return (
    <>
      <KeyValueRows rows={detailRows(e)} aria-label="Entry" />
      {changes.length > 0 ? (
        <Panel title="What changed" padded={false}>
          <table className="w-full border-collapse font-wds-sans text-[13px] leading-4">
            <thead>
              <tr className="border-b border-wds-neutral-100 text-left font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">
                <th scope="col" className="px-[18px] py-2 font-normal">FIELD</th>
                <th scope="col" className="px-2 py-2 font-normal">BEFORE</th>
                <th scope="col" className="px-2 py-2 font-normal">AFTER</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field} className="border-b border-wds-neutral-100 last:border-b-0">
                  <th scope="row" className="px-[18px] py-2 text-left font-normal text-wds-text-secondary">{c.field}</th>
                  <td className="px-2 py-2 text-wds-text-secondary">{c.before}</td>
                  <td className="px-2 py-2 text-wds-text-ink">{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
      <Panel title="Proof">
        <div className="flex flex-col gap-2">
          <KeyValueRows
            topRule={false}
            rows={[
              { label: 'Entry', value: entryNumber(e.seq), mono: true },
              { label: 'Hash', value: shortHash(e.hash), mono: true },
              { label: 'Follows', value: shortHash(e.prevHash), mono: true },
              ...(e.signature ? [{ label: 'Signed with', value: e.signature }] : []),
            ]}
          />
          <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{AUDIT_COPY.proofLine}</p>
          <ChainLine state={chain.state} />
          {canCheck ? (
            <DialogButton kind="cancel" className="self-start" disabled={chain.state.status === 'running'} onClick={() => void chain.run(e.seq)}>
              Check the chain
            </DialogButton>
          ) : null}
        </div>
      </Panel>
    </>
  );
}

/**
 * One entry in full (6a A3): who, when, why, before and after, and the proof. The server decides what is in it (a reader without the right
 * gets no phone, place or changes). Focus moves into the drawer on open and returns to the row on close (the Sheet does both).
 */
export function EntryDrawer({ row, canCheck, onClose }: { row: { id: string; title: string; flagged: boolean; area: string; event: string } | null; canCheck: boolean; onClose: () => void }) {
  return (
    <WorkforceDrawer open={row !== null} onOpenChange={(open) => !open && onClose()} title={row?.title ?? 'Entry'} subtitle={row ? kickerOf({ area: row.area, event: row.event as never }) : undefined}>
      {row ? (
        <>
          {row.flagged ? <StatusTag tone="warning" className="w-fit">FLAGGED</StatusTag> : null}
          <Body key={row.id} id={row.id} canCheck={canCheck} />
        </>
      ) : null}
    </WorkforceDrawer>
  );
}
