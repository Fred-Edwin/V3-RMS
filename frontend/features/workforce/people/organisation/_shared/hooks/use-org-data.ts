'use client';

import { useRemote, type Remote } from '../../../_shared/hooks/use-remote';
import { orgReads } from '../services/org-services';
import type { DepartmentView, HeadCandidate, OrgOverview, PersonWithoutLogin, PositionDetail, PositionImpact, PositionView } from '../types/org-types';

/** The Organisation reads as `Remote`s. `enabled` waits for the permissions so a screen never flashes "no access". */

export const useOrgOverview = (includeRetired: boolean, enabled = true): Remote<OrgOverview> =>
  useRemote(() => orgReads.overview(includeRetired), `org:${includeRetired}`, enabled);

export const useDepartment = (id: string, perPage: number, enabled = true): Remote<DepartmentView> =>
  useRemote(() => orgReads.department(id, 1, perPage), `dept:${id}:${perPage}`, enabled);

export const useHeadCandidates = (id: string): Remote<HeadCandidate[]> => useRemote(() => orgReads.headCandidates(id), `cands:${id}`);

export const useWithoutLogin = (id: string, enabled: boolean): Remote<PersonWithoutLogin[]> =>
  useRemote(() => orgReads.withoutLogin(id), `nologin:${id}`, enabled);

export const usePositions = (q: string, includeRetired = false, enabled = true): Remote<PositionView[]> =>
  useRemote(() => orgReads.positions({ q: q || undefined, includeRetired }), `positions:${q}:${includeRetired}`, enabled);

export const usePosition = (id: string | null): Remote<PositionDetail> | null => {
  const remote = useRemote(() => (id ? orgReads.position(id) : Promise.reject(new Error('none'))), `position:${id ?? ''}`, id !== null);
  return id ? remote : null;
};

export const usePositionImpact = (id: string, defaultTracksTime: boolean, enabled: boolean): Remote<PositionImpact> =>
  useRemote(() => orgReads.positionImpact(id, defaultTracksTime), `impact:${id}:${defaultTracksTime}`, enabled);
