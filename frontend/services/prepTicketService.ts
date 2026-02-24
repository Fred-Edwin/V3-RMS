import { apiClient } from '@/lib/apiClient';
import type { PaginationMeta, PrepTicketDetail, PrepTicketStatus } from '@/types/order';

interface GetPrepTicketsParams {
  status?: PrepTicketStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

const toQueryString = (params: GetPrepTicketsParams): string => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const prepTicketService = {
  getTickets: async (
    params: GetPrepTicketsParams,
    accessToken: string,
  ): Promise<{ tickets: PrepTicketDetail[]; pagination: PaginationMeta }> => {
    const response = await apiClient.getWithEnvelope<PrepTicketDetail[]>(
      `/prep-tickets${toQueryString(params)}`,
      accessToken,
    );

    return {
      tickets: response.data ?? [],
      pagination: response.pagination ?? {
        total: 0,
        page: params.page ?? 1,
        perPage: params.perPage ?? 20,
        totalPages: 1,
      },
    };
  },

  claim: (id: string, claimedById: string, accessToken: string): Promise<PrepTicketDetail> => {
    return apiClient.patch<PrepTicketDetail>(`/prep-tickets/${id}/claim`, { claimedById }, accessToken);
  },

  markReady: (id: string, accessToken: string): Promise<PrepTicketDetail> => {
    return apiClient.patch<PrepTicketDetail>(`/prep-tickets/${id}/ready`, {}, accessToken);
  },
};
