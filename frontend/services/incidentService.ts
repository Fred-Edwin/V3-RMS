import { apiClient } from '@/lib/apiClient';
import type { PaginationMeta } from '@/types/order';

export type IncidentType =
  | 'ORDER_CANCELLED'
  | 'TICKET_REJECTED'
  | 'MODIFICATION_REQUESTED'
  | 'MODIFICATION_APPROVED'
  | 'MODIFICATION_REJECTED'
  | 'TICKET_UNCLAIMED'
  | 'ORDER_STALE'
  | 'ORDER_ITEM_REMOVED';

export interface Incident {
  id: string;
  organizationId: string;
  branchName: string;
  orderId: string | null;
  type: IncidentType;
  actor: { id: string; name: string } | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface GetIncidentsParams {
  type?: IncidentType;
  startDate?: string;
  endDate?: string;
  orderId?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
}

const toQueryString = (params: GetIncidentsParams): string => {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.orderId) query.set('orderId', params.orderId);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const incidentService = {
  getMany: async (
    params: GetIncidentsParams,
    accessToken: string,
  ): Promise<{ incidents: Incident[]; pagination: PaginationMeta }> => {
    const response = await apiClient.getWithEnvelope<Incident[]>(
      `/incidents${toQueryString(params)}`,
      accessToken,
    );

    return {
      incidents: response.data ?? [],
      pagination: response.pagination ?? {
        total: 0,
        page: params.page ?? 1,
        perPage: params.perPage ?? 20,
        totalPages: 1,
      },
    };
  },
};
