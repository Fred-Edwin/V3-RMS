import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { commsController } from '../controllers/comms-controller';

const commsRoutes = Router();

const ALL_HUMAN_ROLES = [
  'DIRECTOR',
  'MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
] as const;

// ─── Direct Conversations ──────────────────────────────────────────────────

commsRoutes.get('/comms/conversations', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getConversations);
commsRoutes.post('/comms/conversations', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getOrCreateConversation);
commsRoutes.get('/comms/conversations/:conversationId/messages', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getMessages);
commsRoutes.post('/comms/conversations/:conversationId/messages', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.sendMessage);
commsRoutes.patch('/comms/messages/:messageId/read', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.markMessageRead);
commsRoutes.delete('/comms/messages/:messageId', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.deleteMessage);

// ─── Broadcasts ────────────────────────────────────────────────────────────

// Read: all staff
commsRoutes.get('/comms/broadcasts', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getBroadcasts);
commsRoutes.get('/comms/broadcasts/:broadcastId', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getBroadcastDetail);
commsRoutes.patch('/comms/broadcasts/:broadcastId/read', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.markBroadcastRead);
commsRoutes.patch('/comms/broadcasts/:broadcastId/acknowledge', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.acknowledgeBroadcast);

// Write / status: manager and director only
commsRoutes.post('/comms/broadcasts', authenticate, requireRole('MANAGER', 'DIRECTOR'), commsController.sendBroadcast);
commsRoutes.get('/comms/broadcasts/:broadcastId/status', authenticate, requireRole('MANAGER', 'DIRECTOR'), commsController.getBroadcastStatus);

// ─── Formal Notices ────────────────────────────────────────────────────────

// Read: all staff
commsRoutes.get('/comms/notices', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getNotices);
commsRoutes.get('/comms/notices/:noticeId', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.getNoticeDetail);
commsRoutes.patch('/comms/notices/:noticeId/acknowledge', authenticate, requireRole(...ALL_HUMAN_ROLES), commsController.acknowledgeNotice);

// Write / status: director only
commsRoutes.post('/comms/notices', authenticate, requireRole('DIRECTOR'), commsController.issueNotice);
commsRoutes.get('/comms/notices/:noticeId/status', authenticate, requireRole('DIRECTOR'), commsController.getNoticeStatus);

export default commsRoutes;
