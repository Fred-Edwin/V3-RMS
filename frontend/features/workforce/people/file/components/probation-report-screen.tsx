'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { EmptyState, ErrorBlock, ListSkeleton } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { ProbationReportDialog } from './dialogs/report-dialog';

/**
 * The head's probation report (frames 9.1 and 9.3), opened from the head's "For you to do" card at `/app/workforce/probation/[id]/report`.
 * It loads the person's file (the server shows a head only their own department's people), and offers the report form only when the
 * server's `actions.writeNote` allows it. Sending takes the head back to Home.
 */
export function ProbationReportScreen({ id }: { id: string }) {
  const router = useRouter();
  const file = useEmployeeFile(id);
  const data = file.data;
  const goHome = React.useCallback(() => router.push('/app/workforce'), [router]);
  return (
    <PeopleFrame breadcrumb={{ root: 'Department', section: 'Probation report', screen: data?.name ?? 'Report' }} phoneTitle="Probation report" label="Probation report">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 py-6">
        {file.status === 'error' ? (
          file.error.status === 404 || file.error.status === 403 ? (
            <EmptyState kind="nothingFound" title="This person is not on your team" line="You can report only on people in your own department." action={{ label: 'Back to Home', onClick: goHome }} />
          ) : (
            <ErrorBlock title="The file did not load" line="Nothing was changed. Try again." onRetry={file.reload} />
          )
        ) : !data ? (
          <ListSkeleton rows={3} columns={[100, 'fill']} label="Loading" />
        ) : !data.actions.writeNote ? (
          <EmptyState kind="nothingYet" title="There is no probation to report on" line={`${data.name} is not on probation, or has already been decided.`} action={{ label: 'Back to Home', onClick: goHome }} />
        ) : (
          <ProbationReportDialog file={data} onClose={goHome} done={goHome} />
        )}
      </div>
    </PeopleFrame>
  );
}
