import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { deliveryZoneService } from '../services/delivery-zone-service';
import {
  CreateDeliveryZoneSchema,
  DeliveryZoneIdParamSchema,
  UpdateDeliveryZoneSchema,
} from '../validators/delivery-zone-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const deliveryZoneController = {
  listZones: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const zones = await deliveryZoneService.listZones(actor);

    res.status(200).json({
      success: true,
      data: zones,
    });
  },

  createZone: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateDeliveryZoneSchema.parse(req.body);
    const zone = await deliveryZoneService.createZone(actor, data);

    res.status(201).json({
      success: true,
      data: zone,
      message: 'Delivery zone created successfully',
    });
  },

  updateZone: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DeliveryZoneIdParamSchema.parse(req.params);
    const data = UpdateDeliveryZoneSchema.parse(req.body);
    const zone = await deliveryZoneService.updateZone(actor, id, data);

    res.status(200).json({
      success: true,
      data: zone,
      message: 'Delivery zone updated successfully',
    });
  },

  deleteZone: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DeliveryZoneIdParamSchema.parse(req.params);
    await deliveryZoneService.deleteZone(actor, id);

    res.status(200).json({
      success: true,
      message: 'Delivery zone deactivated',
    });
  },
};
