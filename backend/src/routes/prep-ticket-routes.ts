import { Router } from 'express';
import { prepTicketController } from '../controllers/prep-ticket-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const prepTicketRoutes = Router();

prepTicketRoutes.get(
  '/prep-tickets',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  prepTicketController.getPrepTickets,
);

prepTicketRoutes.patch(
  '/prep-tickets/:id/claim',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  prepTicketController.claimPrepTicket,
);

prepTicketRoutes.patch(
  '/prep-tickets/:id/ready',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  prepTicketController.markPrepTicketReady,
);

prepTicketRoutes.patch(
  '/prep-tickets/:id/reject',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  prepTicketController.rejectPrepTicket,
);

prepTicketRoutes.patch(
  '/prep-tickets/:id/unclaim',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  prepTicketController.unclaimPrepTicket,
);

export default prepTicketRoutes;
