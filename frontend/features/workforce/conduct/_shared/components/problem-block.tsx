'use client';

import { EmptyState, ErrorBlock, ListSkeleton, STATES_COPY, type RemoteError } from '../../../_shared';

/**
 * What every Conduct screen shows when its data did not arrive: loading bars, "not found" (a notice outside the person's reach answers 404,
 * so nobody learns it exists), no permission (403), no signal (status 0) or the kit's error with a retry. The words come from the States kit.
 */
export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return <ListSkeleton rows={rows} columns={['fill']} label={label} />;
}

export function ProblemBlock({ error, what, onRetry }: { error: RemoteError; what: string; onRetry: () => void }) {
  if (error.status === 404) return <EmptyState kind="nothingFound" title={`We could not find ${what}.`} line="It may have been moved, or it is not yours to open." />;
  if (error.status === 403) return <EmptyState kind="nothingFound" title="You do not have access to this." line="Ask HR if you think you should." />;
  if (error.status === 0) return <ErrorBlock title={`No signal. ${what} needs a connection to open.`} line="Nothing was changed. Try again when you are back online." onRetry={onRetry} />;
  return <ErrorBlock title={`We could not load ${what}.`} line={STATES_COPY.conduct.error} reference={error.code} onRetry={onRetry} />;
}
