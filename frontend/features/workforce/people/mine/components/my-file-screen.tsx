'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { EmptyState, ErrorBlock, ListSkeleton, PersonAvatar } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { firstName } from '../../file/lib/file-model';
import { finishProgress, stillToFinish, type OwnDialog } from '../lib/own-file';
import { OwnContactCard, OwnInfoNote, SavedBar } from './own-contact-card';
import { OwnContactDialog } from './own-contact-dialog';
import { FinishCard, JobCard } from './own-file-cards';
import { EmergencyDialog } from './own-dialogs';
import { OwnIdsCard } from './own-ids-card';
import { OwnNumbersDialog } from './own-numbers-dialog';
import { OwnNumbersPage } from './own-numbers-page';
import { PhotoPages } from './photo-pages';

/**
 * My file (Paper `SJY-0` steps 2 and 3, `12UL-0`): a dark header with how far you are, "Still to finish" with an Add button for each
 * thing HR needs from you, then your own job and your own IDs and bank in clear. It reads `me`, so nobody else's file is reachable.
 */
export function MyFileScreen() {
  const file = useEmployeeFile('me');
  const [form, setForm] = React.useState<OwnDialog | null>(null);
  const [saved, setSaved] = React.useState(false);
  // A phone gets full pages (frames 8.3 to 8.6); a desktop gets a dialog.
  const desktop = useMediaQuery('(min-width: 1024px)');
  const data = file.data;
  const reload = file.reload;
  // Every save says the same thing, in the words of frame 8.2.
  const done = React.useCallback(() => {
    setForm(null);
    setSaved(true);
    reload();
  }, [reload]);
  const clearSaved = React.useCallback(() => setSaved(false), []);

  return (
    <PeopleFrame breadcrumb={{ section: 'Me', screen: 'My file' }} phoneTitle="My file" label="My file">
      {!data ? (
        <div className="mx-auto w-full max-w-[640px] px-4 py-6">
          {file.status === 'error' ? <ErrorBlock title="Your file did not load" line="Nothing was changed. Try again." onRetry={file.reload} /> : <ListSkeleton rows={4} columns={[100, 'fill']} label="Loading your file" />}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pb-8 pt-6">
          <header className="flex items-center gap-[14px] bg-wds-sidebar-mid px-5 py-5 text-wds-primary-fg">
            <PersonAvatar name={data.name} size="lg" photoUrl={data.photoUrl} />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <h1 className="m-0 font-wds-sans text-[22px] font-semibold leading-[26px] tracking-[-0.02em]">{data.name}</h1>
              <p className="m-0 font-wds-sans text-[13px] leading-4 opacity-80">{[data.position?.name, data.organization.name].filter(Boolean).join(' · ')}</p>
              <Progress file={data} />
            </div>
          </header>
          {stillToFinish(data).length === 0 ? <EmptyState kind="nothingYet" title={`Your file is complete, ${firstName(data.name)}`} line="Nothing is waiting on you." /> : <FinishCard file={data} open={setForm} />}
          <JobCard file={data} />
          <OwnIdsCard file={data} onEdit={() => setForm('numbers')} />
          <OwnInfoNote>Only you and HR see these. Payroll uses them as soon as you save.</OwnInfoNote>
          <OwnContactCard file={data} onEdit={() => setForm('contact')} />
          <Button type="button" variant="flat" className="min-h-11 self-start" onClick={() => setForm('photo')}>
            {data.photoUrl ? 'Change my photo' : 'Add a photo'}
          </Button>
          {form === 'emergency' ? <EmergencyDialog onClose={() => setForm(null)} done={done} /> : null}
          {form === 'contact' ? <OwnContactDialog file={data} onClose={() => setForm(null)} done={done} /> : null}
          {saved ? <SavedBar message="Saved. Your file is updated." onGone={clearSaved} /> : null}
          {form === 'numbers' ? (desktop.matches ? <OwnNumbersDialog file={data} onClose={() => setForm(null)} done={done} /> : <OwnNumbersPage file={data} onClose={() => setForm(null)} done={done} />) : null}
          {form === 'photo' ? <PhotoPages name={data.name} onClose={() => setForm(null)} done={done} /> : null}
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
      <div role="progressbar" aria-label="File finished" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-[5px] w-40 bg-wds-neutral-800">
        <div className="h-full bg-[#D9A65E]" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="font-wds-mono text-[11px] leading-[14px] opacity-80">{done} OF {total}</span>
    </div>
  );
}
