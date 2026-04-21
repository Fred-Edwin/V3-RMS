import { apiClient } from '@/lib/apiClient';
import type {
  CreateOrderDto,
  OrderDetail,
  OrderListView,
  OrderStatus,
  OrderSummary,
  OrderType,
  PaginationMeta,
  PaymentMethod,
  UpdateOrderItemsDto,
} from '@/types/order';

interface GetOrdersParams {
  status?: OrderStatus;
  type?: OrderType;
  date?: string;
  startDate?: string;
  endDate?: string;
  view?: OrderListView;
  page?: number;
  perPage?: number;
  createdById?: string;
  prepTicketClaimedById?: string;
  branchId?: string;
}

const toQueryString = (params: GetOrdersParams): string => {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.date) query.set('date', params.date);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.view) query.set('view', params.view);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));
  if (params.createdById) query.set('createdById', params.createdById);
  if (params.prepTicketClaimedById) query.set('prepTicketClaimedById', params.prepTicketClaimedById);
  if (params.branchId) query.set('branchId', params.branchId);

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const orderService = {
  create: (data: CreateOrderDto, accessToken: string): Promise<OrderDetail> => {
    return apiClient.post<OrderDetail>('/orders', data, accessToken);
  },

  getMany: async (
    params: GetOrdersParams,
    accessToken: string,
  ): Promise<{ orders: OrderSummary[]; pagination: PaginationMeta; totalValue: number }> => {
    const response = await apiClient.getWithEnvelope<OrderSummary[]>(
      `/orders${toQueryString(params)}`,
      accessToken,
    );

    return {
      orders: response.data ?? [],
      pagination: response.pagination ?? {
        total: 0,
        page: params.page ?? 1,
        perPage: params.perPage ?? 20,
        totalPages: 1,
      },
      totalValue: response.totalValue ?? 0,
    };
  },

  getActive: (accessToken: string, view: OrderListView = 'full'): Promise<OrderSummary[]> => {
    const query = view === 'summary' ? '?view=summary' : '';
    return apiClient.get<OrderSummary[]>(`/orders/active${query}`, accessToken);
  },

  getById: (id: string, accessToken: string, branchId?: string): Promise<OrderDetail> => {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.get<OrderDetail>(`/orders/${id}${query}`, accessToken);
  },

  updateItems: (id: string, data: UpdateOrderItemsDto, accessToken: string): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/items`, data, accessToken);
  },

  recordPayment: (
    id: string,
    payload: {
      paymentMethod: PaymentMethod;
      mpesaCode?: string;
      mpesaAmount?: number;
      cashAmount?: number;
      cardAmount?: number;
      splitType?: string;
    },
    accessToken: string,
  ): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/payment`, payload, accessToken);
  },

  cancel: (
    id: string,
    data: { reason: string; reasonDetail?: string },
    accessToken: string,
  ): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/cancel`, data, accessToken);
  },

  managerRemoveItems: (
    id: string,
    data: { removeItemIds: string[]; reason: string },
    accessToken: string,
  ): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/manager-edit`, data, accessToken);
  },

  accountOrder: (
    id: string,
    data: {
      paymentMethod: string;
      mpesaCode?: string;
      mpesaAmount?: number;
      cashAmount?: number;
      cardAmount?: number;
      splitType?: string;
      note?: string;
    },
    accessToken: string,
    branchId?: string,
  ): Promise<OrderDetail> => {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.patch<OrderDetail>(`/orders/${id}/account${query}`, data, accessToken);
  },
};
