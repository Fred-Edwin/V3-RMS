import { z } from 'zod';
import { confirmDeliveryInputSchema, listDeliveriesQuerySchema, saveCountInputSchema, setReasonInputSchema, uploadPhotoFieldsSchema } from './_shared/deliveries-contract';

/** The request schemas are the frozen contract's (`_shared/deliveries-contract.ts`); only the path params are local. */
export { confirmDeliveryInputSchema, listDeliveriesQuerySchema, saveCountInputSchema, setReasonInputSchema, uploadPhotoFieldsSchema };

export const deliveryParamsSchema = z.object({ id: z.string().uuid() });
export const deliveryLineParamsSchema = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });
export const deliveryPhotoParamsSchema = z.object({ id: z.string().uuid(), photoId: z.string().uuid() });
export const photoParamsSchema = z.object({ photoId: z.string().uuid() });
