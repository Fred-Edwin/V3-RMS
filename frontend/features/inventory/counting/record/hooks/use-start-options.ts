'use client';

import { useLoader } from '../../../_shared/hooks/use-async';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';

/** C8: today's sections, who is busy, the caller's own open count, and the recount line when `recountLineId` is given. */
export function useStartOptions(recountLineId?: string) {
  return useLoader(`start-options:${recountLineId ?? ''}`, () => countingApi.startOptions(recountLineId), COUNTING_STATES_COPY.pickSection.error);
}
