import { apiClient } from '@/lib/apiClient';
import type { Discount, CreateDiscountInput, UpdateDiscountInput } from '@/types/discount';

export const discountService = {
  list: (token: string): Promise<Discount[]> =>
    apiClient.get<Discount[]>('/discounts', token),

  create: (data: CreateDiscountInput, token: string): Promise<Discount> =>
    apiClient.post<Discount>('/discounts', data, token),

  update: (discountId: string, data: UpdateDiscountInput, token: string): Promise<Discount> =>
    apiClient.patch<Discount>(`/discounts/${discountId}`, data, token),

  deactivate: (discountId: string, token: string): Promise<Discount> =>
    apiClient.delete<Discount>(`/discounts/${discountId}`, token),
};
