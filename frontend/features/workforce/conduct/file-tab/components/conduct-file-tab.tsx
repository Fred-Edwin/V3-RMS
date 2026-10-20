'use client';

import * as React from 'react';

import { DialogButton, EmptyState, STATES_COPY, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { LegacyRows } from '../../_shared/components/legacy-rows';
import { conductReads } from '../../_shared/services/conduct-services';
import { IssuePanel } from '../../issue/components/issue-panel';
import { FileNoticeCards } from './file-notice-cards';
import { FileAccessTable, FileTimeline } from './file-timeline-and-access';

/**
 * The Conduct tab of an employee file (spec S14; Paper 1HGH-0): every notice on one person's file, the timeline of what happened, the
 * old HR records read only, and who can see conduct. The tab itself is only offered to roles with `discipline.read`; the server answers
 * 404 for a person outside the reader's reach and 403 for a role without the capability, and the tab says so. "Issue a warning" appears
 * only when the server says this reader may issue to this person.
 */
export function ConductFileTab({ employeeId, personName }: { employeeId: string; personName: string }) {
  const tab = useRemote(() => conductReads.fileTab(employeeId), `conduct-file:${employeeId}`);
  const [issuing, setIssuing] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const reload = tab.reload;
  const done = React.useCallback(
    (message: string) => {
      setIssuing(false);
      setNote(message);
      reload();
    },
    [reload]
  );
  const data = tab.data;

  if (tab.status === 'loading' && !data) return <LoadingBlock label="Loading conduct" />;
  if (tab.status === 'error' && !data) return <ProblemBlock error={tab.error} what="this person's conduct" onRetry={reload} />;
  if (!data) return null;
  const count = data.notices.length;

  return (
    <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">
            NOTICES ON THIS FILE · {count}, NONE DELETED
          </h2>
          {data.canIssue ? (
            <DialogButton kind="primary" size="lg" onClick={() => setIssuing(true)}>
              Issue a warning
            </DialogButton>
          ) : null}
        </div>
        {note ? <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-success-fg">{note}</p> : null}
        {count === 0 ? <EmptyState kind="nothingYet" title={STATES_COPY.conduct.nothingYet.replace('No notices on file.', 'No notices on this file.')} /> : <FileNoticeCards notices={data.notices} />}
        {data.timeline.length > 0 ? <FileTimeline rows={data.timeline} /> : null}
        {data.legacy.length > 0 ? <LegacyRows rows={data.legacy} /> : null}
      </div>
      <FileAccessTable rows={data.access} />
      {issuing ? <IssuePanel open onClose={() => setIssuing(false)} onDone={done} presetPerson={{ id: employeeId, name: personName, department: null, employeeNumber: '', isMyTeam: true, hasLogin: true, activeNotices: [] }} /> : null}
    </div>
  );
}
