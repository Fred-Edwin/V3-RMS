'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { EmptyState, ErrorBlock, ListSkeleton } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { ProbationReportDialog } from './dialogs/report-dialog';
import { ProbationReportPage } from './probation-report-page';

/**
 * The head's probation report, opened from the head's "For you to do" card at `/app/workforce/probation/[id]/report`: a full page on a
 * phone (frame 9.1) and a dialog on a desktop (frame 9.3). It loads the person's file (the server shows a head only their own
 * department's people), and offers the form only when the server's `actions.writeNote` allows it. Sending takes the head back to Home.
 */
export function ProbationReportScreen({ id }: { id: string }) {
  const router = useRouter();
  const file = useEmployeeFile(id);
  const data = file.data;
  const desktop = useMediaQuery('(min-width: 1024px)');
  const goHome = React.useCallback(() => router.push('/app/workforce'), [router]);
  const ready = data && data.actions.writeNote ? data : null;
  if (ready && desktop.hydrated && !desktop.matches) return <ProbationReportPage file={ready} done={goHome} />;
  return (
    <PeopleFrame breadcrumb={{ root: 'Department', section: 'Probation report', screen: data?.name ?? 'Report' }} phoneTitle="Probation report" label="Probation report">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 py-6">
        {file.status === 'error' ? (
          file.error.status === 404 || file.error.status === 403 ? (
            <EmptyState kind="nothingFound" title="This person is not on your team" line="You can report only on people in your own department." action={{ label: 'Back to Home', onClick: goHome }} />
          ) : (
            <ErrorBlock title="The file did not load" line="Nothing was changed. Try again." onRetry={file.reload} />
          )
        ) : !data || !desktop.hydrated ? (
          <ListSkeleton rows={3} columns={[100, 'fill']} label="Loading" />
        ) : !ready ? (
          <EmptyState kind="nothingYet" title="There is no probation to report on" line={`${data.name} is not on probation, or has already been decided.`} action={{ label: 'Back to Home', onClick: goHome }} />
        ) : (
          <ProbationReportDialog file={ready} onClose={goHome} done={goHome} />
        )}
      </div>
    </PeopleFrame>
  );
}
