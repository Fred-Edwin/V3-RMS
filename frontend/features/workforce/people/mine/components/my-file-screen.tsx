'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { EmptyState, ErrorBlock, KeyValueRows, ListSkeleton, Panel, PersonAvatar } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { formatDayMonth } from '../../_shared/lib/people-dates';
import { PhotoDialog } from '../../file/components/dialogs/upload-dialogs';
import { SensitivePanel } from '../../file/components/sensitive/sensitive-panel';
import { firstName } from '../../file/lib/file-model';
import { jobRows } from '../../file/lib/file-rows';
import { finishProgress, stillToFinish, type OwnForm } from '../lib/own-file';
import { EmergencyDialog, NumbersDialog } from './own-dialogs';

/**
 * My file (Paper `SJY-0` steps 2 and 3, `12UL-0`): a dark header with how far you are, "Still to finish" with an Add button for each
 * thing HR needs from you, then your own job and your own IDs and bank in clear. It reads `me`, so nobody else's file is reachable.
 */
export function MyFileScreen() {
  const file = useEmployeeFile('me');
  const [form, setForm] = React.useState<OwnForm | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const data = file.data;
  const reload = file.reload;
  const done = React.useCallback(
    (message: string) => {
      setForm(null);
      setNotice(message);
      reload();
    },
    [reload]
  );

  return (
    <PeopleFrame breadcrumb={{ section: 'Me', screen: 'My file' }} phoneTitle="My file" label="My file">
      {!data ? (
        <div className="mx-auto w-full max-w-[640px] px-4 py-6">
          {file.status === 'error' ? <ErrorBlock title="Your file did not load" line="Nothing was changed. Try again." onRetry={file.reload} /> : <ListSkeleton rows={4} columns={[100, 'fill']} label="Loading your file" />}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pb-10 pt-6">
          <header className="flex items-center gap-4 bg-wds-sidebar-mid px-5 py-5 text-wds-primary-fg">
            <PersonAvatar name={data.name} size="lg" photoUrl={data.photoUrl} />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="m-0 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em]">{data.name}</h1>
              <p className="m-0 font-wds-sans text-[13px] leading-[18px] opacity-80">{[data.position?.name, data.organization.name].filter(Boolean).join(' · ')}</p>
              <Progress file={data} />
            </div>
          </header>
          {notice ? <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-2.5 font-wds-sans text-[14px] text-wds-success-fg">{notice}</p> : null}
          <Finish file={data} open={setForm} />
          <Panel title="Your job" padded={false}>
            <KeyValueRows rows={jobRows(data)} aria-label="Your job" topRule={false} className="[&>div]:px-[18px]" />
          </Panel>
          <SensitivePanel file={data} own />
          <Button type="button" variant="flat" className="self-start" onClick={() => setForm('photo')}>
            {data.photoUrl ? 'Change my photo' : 'Add a photo'}
          </Button>
          {form === 'emergency' ? <EmergencyDialog onClose={() => setForm(null)} done={done} /> : null}
          {form === 'numbers' ? <NumbersDialog onClose={() => setForm(null)} done={done} /> : null}
          {form === 'photo' ? <PhotoDialog file={data} onClose={() => setForm(null)} done={done} /> : null}
        </div>
      )}
    </PeopleFrame>
  );
}

function Progress({ file }: { file: NonNullable<ReturnType<typeof useEmployeeFile>['data']> }) {
  const { done, total } = finishProgress(file);
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-2.5">
      <div role="progressbar" aria-label="File finished" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1 w-40 bg-wds-neutral-800">
        <div className="h-full bg-wds-caramel-300" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] opacity-80">{done} OF {total}</span>
    </div>
  );
}

function Finish({ file, open }: { file: NonNullable<ReturnType<typeof useEmployeeFile>['data']>; open: (f: OwnForm) => void }) {
  const rows = stillToFinish(file, formatDayMonth);
  if (rows.length === 0) return <EmptyState kind="nothingYet" title={`Your file is complete, ${firstName(file.name)}`} line="Nothing is waiting on you." />;
  return (
    <Panel title="Still to finish" padded={false}>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 border-t border-wds-border px-[18px] py-3 first:border-t-0">
            <span className="flex min-w-0 flex-col">
              <span className="font-wds-sans text-[15px] leading-5 text-wds-text-ink">{r.title}</span>
              {r.detail ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.detail}</span> : null}
            </span>
            <button type="button" aria-label={`${r.action} ${r.title}`} onClick={() => open(r.key)} className="border-0 bg-transparent p-0 font-wds-sans text-[14px] leading-[18px] text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
              {r.action}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
