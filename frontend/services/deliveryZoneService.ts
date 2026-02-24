import { apiClient } from '@/lib/apiClient';
import type { DeliveryZoneSummary } from '@/types/order';

export interface DeliveryZone extends DeliveryZoneSummary {
  isActive: boolean;
}

export interface CreateDeliveryZoneInput {
  name: string;
  fee: string;
}

export interface UpdateDeliveryZoneInput {
  name?: string;
  fee?: string;
  isActive?: boolean;
}

export const deliveryZoneService = {
  listZones: (accessToken: string): Promise<DeliveryZone[]> => {
    return apiClient.get('/delivery-zones', accessToken);
  },

  createZone: (data: CreateDeliveryZoneInput, accessToken: string): Promise<DeliveryZone> => {
    return apiClient.post('/delivery-zones', data, accessToken);
  },

  updateZone: (id: string, data: UpdateDeliveryZoneInput, accessToken: string): Promise<DeliveryZone> => {
    return apiClient.patch(`/delivery-zones/${id}`, data, accessToken);
  },

  deleteZone: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete(`/delivery-zones/${id}`, accessToken);
  },
};
