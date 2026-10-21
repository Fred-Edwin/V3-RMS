'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';

import { Callout, EmptyState, ErrorBlock, ListSkeleton, StatusTag } from '../../../../_shared';
import { useEmployeeDocuments } from '../../../_shared/hooks/use-people-data';
import { peopleReads } from '../../../_shared/services/people-reads';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { documentLines } from '../../lib/documents-rows';

/**
 * Documents (Paper `YW5-0`): the missing contract, the details asked of the person, then each file. Opening a file asks the server for
 * a link (R10), which writes the opening to the audit log, so nothing is fetched until "Open" is pressed.
 */
export function DocumentsTab({ file, reloadKey }: { file: EmployeeFile; reloadKey: number }) {
  const documents = useEmployeeDocuments(file.id, true);
  const reload = documents.reload;
  const lastKey = React.useRef(reloadKey);
  React.useEffect(() => {
    if (lastKey.current !== reloadKey) {
      lastKey.current = reloadKey;
      reload();
    }
  }, [reloadKey, reload]);
  const [opening, setOpening] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  const openFile = async (docId: string): Promise<void> => {
    setOpening(docId);
    setProblem(null);
    try {
      const { url } = await peopleReads.openDocument(file.id, docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'We could not open that file. Try again.'));
    } finally {
      setOpening(null);
    }
  };

  if (documents.status === 'error' && !documents.data) return <ErrorBlock title="The documents did not load" line="Nothing was changed. Try again." onRetry={documents.reload} />;
  if (!documents.data) return <ListSkeleton rows={4} columns={[160, 'fill', 90]} label="Loading documents" />;
  const lines = documentLines(file, documents.data);
  return (
    <div className="flex flex-col gap-5">
      {lines.length === 0 ? (
        <EmptyState kind="nothingYet" title="No documents yet" line="Contracts, IDs and certificates appear here once they are on file." />
      ) : (
        <section aria-label="Documents" className="overflow-x-auto border border-wds-border bg-wds-surface">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-wds-text-ink">
                {['DOCUMENT', 'STATUS', ''].map((h, i) => (
                  <th key={h || i} scope="col" className={cn('px-4 py-3 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary', i === 2 && 'w-24')}>
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className={cn('border-b border-wds-neutral-100 last:border-b-0', l.detailTone === 'warning' && 'bg-wds-warning-bg/40')}>
                  <td className="px-4 py-3.5">
                    <div className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{l.title}</div>
                    <div className={cn('font-wds-sans text-[12px] leading-4', l.detailTone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{l.detail}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusTag tone={l.status.tone} size="row">
                      {l.status.label}
                    </StatusTag>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {l.documentId ? (
                      <Button type="button" variant="flat" size="sm" disabled={opening === l.documentId} aria-label={`Open ${l.title}`} onClick={() => void openFile(l.documentId as string)}>
                        {opening === l.documentId ? 'Opening…' : 'Open'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {problem ? <Callout tone="error" role="alert">{problem}</Callout> : null}
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <section className="flex flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 px-4 py-3.5">
          <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">WHY EVERY OPENING IS LOGGED</h3>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">IDs and contracts are personal. Opening one writes your name and the time to the audit log.</p>
        </section>
        <section className="flex flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 px-4 py-3.5">
          <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">HOW A CONTRACT IS RECORDED</h3>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">A contract is recorded here with its dates. A signed copy cannot be edited: a change is a new version. Signing with a PIN is added later.</p>
        </section>
      </div>
    </div>
  );
}
