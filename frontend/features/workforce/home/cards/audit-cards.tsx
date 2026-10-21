'use client';

import { useMemo } from 'react';

import { PayslipOpensCard, usePayslipOpens } from '../../audit';
import { defineHomeCard, type CardDataState } from '../lib/card-registry';

/**
 * "Payslip openings" (Segment 6b, 6a A9): the Director's side card. Held by whoever holds `audit.read.payslip_access` (the Director alone
 * in the access table). A week with no openings is not drawn.
 */
type Opens = NonNullable<ReturnType<typeof usePayslipOpens>['data']>;

function useOpensCardData(): CardDataState<Opens> {
  const opens = usePayslipOpens();
  return useMemo((): CardDataState<Opens> => {
    if (opens.status === 'loading') return { status: 'loading' };
    if (opens.status === 'error' && !opens.data) return { status: 'error', retry: opens.reload };
    return opens.data ? { status: 'ready', data: opens.data } : { status: 'loading' };
  }, [opens]);
}

export const payslipOpensCard = defineHomeCard<Opens>({
  id: 'workforce.payslip-openings',
  title: 'Payslip openings',
  surfaces: ['desktop'],
  slot: 'side',
  anyCapability: ['audit.read.payslip_access'],
  order: 40,
  isEmpty: (d) => d.days.length === 0,
  useData: useOpensCardData,
  Card: ({ data }) => <PayslipOpensCard days={data.days} />,
});
