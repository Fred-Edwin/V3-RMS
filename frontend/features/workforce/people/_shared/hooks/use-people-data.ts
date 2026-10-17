'use client';

import { peopleReads } from '../services/people-reads';
import type { DocumentRow, EmployeeFile, Lookups, PayChangeRow, PayView, PeopleSummary } from '../types/people-types';
import { useRemote, type Remote } from './use-remote';

/** The reads the screens share, each as a `Remote`. A screen that needs one calls the hook; none builds a path. */

export const useLookups = (enabled = true): Remote<Lookups> => useRemote(peopleReads.lookups, 'lookups', enabled);

export const usePeopleSummary = (enabled = true): Remote<PeopleSummary> => useRemote(() => peopleReads.summary(), 'summary', enabled);

export const useEmployeeFile = (id: string | 'me'): Remote<EmployeeFile> =>
  useRemote(() => (id === 'me' ? peopleReads.mine() : peopleReads.file(id)), `file:${id}`);

/** Pay opens only when the screen asks (the tab is chosen): opening it is audited, so it is never fetched ahead. */
export const useEmployeePay = (id: string, enabled: boolean): Remote<PayView> => useRemote(() => peopleReads.pay(id), `pay:${id}`, enabled);

export const useEmployeeDocuments = (id: string, enabled: boolean): Remote<DocumentRow[]> => useRemote(() => peopleReads.documents(id), `docs:${id}`, enabled);

export const usePendingPayChanges = (enabled: boolean): Remote<PayChangeRow[]> => useRemote(() => peopleReads.payChanges('PENDING'), 'pay-changes', enabled);
