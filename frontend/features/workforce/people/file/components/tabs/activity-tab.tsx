import * as React from 'react';

import { Callout, EmptyState, StatusTag } from '../../../../_shared';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { activityRows } from '../../lib/file-timeline';

/**
 * Activity (Paper `Z7M-0`). The API has no audit read by person yet, so this shows what the file itself knows (hires, pay changes,
 * moves, decisions, documents) and says plainly that the full trail, with every opening, arrives with the Audit log.
 */
export function ActivityTab({ file }: { file: EmployeeFile }) {
  const rows = activityRows(file);
  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState kind="nothingYet" title="Nothing has happened on this file yet" line="Changes and decisions appear here as they are made." />
      ) : (
        <section aria-label="Activity" className="overflow-x-auto border border-wds-border bg-wds-surface">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-wds-text-ink">
                {['WHEN', 'KIND', 'WHAT'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-wds-neutral-100 last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{r.when}</td>
                  <td className="px-4 py-3">
                    <StatusTag tone={r.kind === 'Change' ? 'warning' : r.kind === 'Decision' ? 'success' : 'neutral'} size="row">
                      {r.kind}
                    </StatusTag>
                  </td>
                  <td className="px-4 py-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{r.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Callout tone="neutral">
        This lists what the file itself records. The full trail for {file.name.split(' ')[0]}, including every time someone opened an ID, bank detail or contract, is in the Audit log. Nobody can edit or remove a line.
      </Callout>
    </div>
  );
}
