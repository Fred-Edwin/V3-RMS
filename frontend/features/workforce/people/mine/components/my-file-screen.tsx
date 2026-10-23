'use client';

import * as React from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SignOutEverywhereDialog } from '@/features/workforce/security';

import { EmptyState, ErrorBlock, ListSkeleton } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { firstName } from '../../file/lib/file-model';
import { stillToFinish, type OwnDialog } from '../lib/own-file';
import { AccountCard } from '../account/components/account-card';
import { PhotoDialogs } from '../photo/components/photo-dialogs';
import { PhotoPages } from '../photo/components/photo-pages';
import { OwnContactCard, OwnInfoNote, SavedBar } from './own-contact-card';
import { OwnContactDialog } from './own-contact-dialog';
import { FinishCard, JobCard } from './own-file-cards';
import { EmergencyDialog } from './own-dialogs';
import { OwnHeader } from './own-header';
import { OwnIdsCard } from './own-ids-card';
import { OwnNumbersDialog } from './own-numbers-dialog';
import { OwnNumbersPage } from './own-numbers-page';

type Form = OwnDialog | 'signout';

/**
 * My file (Paper frames 13.3 to 13.7 on a desktop, 13.14 and 8.1 to 8.6 on a phone): a plain identity header with how far you are, then
 * two columns of 560 px on a desktop (Still to finish, Your job, Sign-in and alerts on the left; IDs and bank and Your contact on the
 * right) or one column on a phone. It reads `me`, so nobody else's file is reachable. The photo and the numbers are centred dialogs on
 * a desktop and full pages on a phone.
 */
export function MyFileScreen() {
  const file = useEmployeeFile('me');
  const [form, setForm] = React.useState<Form | null>(null);
  const [saved, setSaved] = React.useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)').matches;
  const data = file.data;
  const reload = file.reload;
  // Every save says the same thing, in the words of frame 8.2.
  const done = React.useCallback(() => {
    setForm(null);
    setSaved(true);
    reload();
  }, [reload]);
  const clearSaved = React.useCallback(() => setSaved(false), []);
  const close = React.useCallback(() => setForm(null), []);

  if (!data) {
    return (
      <PeopleFrame breadcrumb={{ section: 'My account', screen: 'My file' }} phoneTitle="My file" label="My file">
        <div className="mx-auto w-full max-w-[640px] px-4 py-6">
          {file.status === 'error' ? <ErrorBlock title="Your file did not load" line="Nothing was changed. Try again." onRetry={file.reload} /> : <ListSkeleton rows={4} columns={[100, 'fill']} label="Loading your file" />}
        </div>
      </PeopleFrame>
    );
  }

  const finish = stillToFinish(data).length === 0 ? <EmptyState kind="nothingYet" title={`Your file is complete, ${firstName(data.name)}`} line="Nothing is waiting on you." /> : <FinishCard file={data} open={setForm} />;
  const job = <JobCard file={data} />;
  const account = <AccountCard desktop={desktop} onSignOutEverywhere={() => setForm('signout')} />;
  const ids = (
    <>
      <OwnIdsCard file={data} onEdit={() => setForm('numbers')} />
      <OwnInfoNote>Only you and HR see these. Payroll uses them as soon as you save.</OwnInfoNote>
    </>
  );
  const contact = <OwnContactCard file={data} onEdit={() => setForm('contact')} />;

  return (
    <PeopleFrame breadcrumb={{ section: 'My account', screen: 'My file' }} phoneTitle="My file" label="My file">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5 px-4 pb-8 pt-6 lg:px-6">
        <OwnHeader file={data} onPhoto={() => setForm('photo')} />
        {desktop ? (
          <div className="grid grid-cols-2 items-start gap-5">
            <div className="flex flex-col gap-4">{finish}{job}{account}</div>
            <div className="flex flex-col gap-4">{ids}{contact}</div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">{finish}{job}{ids}{contact}{account}</div>
        )}
        {form === 'emergency' ? <EmergencyDialog onClose={close} done={done} /> : null}
        {form === 'contact' ? <OwnContactDialog file={data} onClose={close} done={done} /> : null}
        {form === 'signout' ? <SignOutEverywhereDialog onClose={close} /> : null}
        {saved ? <SavedBar message="Saved. Your file is updated." onGone={clearSaved} /> : null}
        {form === 'numbers' ? (desktop ? <OwnNumbersDialog file={data} onClose={close} done={done} /> : <OwnNumbersPage file={data} onClose={close} done={done} />) : null}
        {form === 'photo' ? (desktop ? <PhotoDialogs name={data.name} onClose={close} done={done} /> : <PhotoPages name={data.name} onClose={close} done={done} />) : null}
      </div>
    </PeopleFrame>
  );
}
