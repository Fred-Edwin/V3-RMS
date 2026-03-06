import type { Request, Response } from 'express';
import { prepTicketService } from '../services/prep-ticket-service';
import { ClaimPrepTicketSchema, PrepTicketQuerySchema, RejectPrepTicketSchema, routeIdParamSchema } from '../validators/order-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const prepTicketController = {
  getPrepTickets: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = PrepTicketQuerySchema.parse(req.query);
    const result = await prepTicketService.getByStation(actor, query);

    res.status(200).json({
      success: true,
      data: result.tickets,
      pagination: result.pagination,
    });
  },

  claimPrepTicket: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const data = ClaimPrepTicketSchema.parse(req.body);
    const ticket = await prepTicketService.claim(id, data, actor);

    res.status(200).json({
      success: true,
      data: ticket,
      message: `Order claimed by ${ticket.claimedBy?.name ?? 'staff'}`,
    });
  },

  markPrepTicketReady: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const ticket = await prepTicketService.markReady(id, actor);

    res.status(200).json({
      success: true,
      data: ticket,
      message: 'Order marked as ready',
    });
  },

  rejectPrepTicket: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const { reason } = RejectPrepTicketSchema.parse(req.body);
    const ticket = await prepTicketService.reject(id, reason, actor);

    res.status(200).json({
      success: true,
      data: ticket,
      message: 'Ticket rejected',
    });
  },

  unclaimPrepTicket: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const ticket = await prepTicketService.unclaim(id, actor);

    res.status(200).json({
      success: true,
      data: ticket,
      message: 'Ticket unclaimed',
    });
  },
};
