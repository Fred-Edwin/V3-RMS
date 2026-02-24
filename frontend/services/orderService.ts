import { apiClient } from '@/lib/apiClient';
import type {
  CreateOrderDto,
  OrderDetail,
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
  page?: number;
  perPage?: number;
}

const toQueryString = (params: GetOrdersParams): string => {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.date) query.set('date', params.date);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));

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
  ): Promise<{ orders: OrderSummary[]; pagination: PaginationMeta }> => {
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
    };
  },

  getActive: (accessToken: string): Promise<OrderSummary[]> => {
    return apiClient.get<OrderSummary[]>('/orders/active', accessToken);
  },

  getById: (id: string, accessToken: string): Promise<OrderDetail> => {
    return apiClient.get<OrderDetail>(`/orders/${id}`, accessToken);
  },

  updateItems: (id: string, data: UpdateOrderItemsDto, accessToken: string): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/items`, data, accessToken);
  },

  recordPayment: (id: string, paymentMethod: PaymentMethod, accessToken: string): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/payment`, { paymentMethod }, accessToken);
  },

  cancel: (id: string, reason: string, accessToken: string): Promise<OrderDetail> => {
    return apiClient.patch<OrderDetail>(`/orders/${id}/cancel`, { reason }, accessToken);
  },
};
