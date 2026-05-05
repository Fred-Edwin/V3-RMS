import type { Request, Response } from 'express';
import { commsService } from '../services/comms-service';
import {
  SendDirectMessageSchema,
  GetOrCreateConversationSchema,
  GetMessagesQuerySchema,
  GetConversationsQuerySchema,
  SendBroadcastSchema,
  IssueNoticeSchema,
  ListQuerySchema,
  conversationIdParamSchema,
  messageIdParamSchema,
  broadcastIdParamSchema,
  noticeIdParamSchema,
} from '../validators/comms-schemas';
import { UnauthorizedError } from '../utils/errors';

export const commsController = {
  // ─── Direct Conversations ──────────────────────────────────────────────────

  /** GET /comms/conversations */
  getConversations: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = GetConversationsQuerySchema.parse(req.query);
    const result = await commsService.getConversations(req.user, query);
    res.status(200).json({ success: true, data: result });
  },

  /** POST /comms/conversations */
  getOrCreateConversation: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const body = GetOrCreateConversationSchema.parse(req.body);
    const result = await commsService.getOrCreateConversation(req.user, body);
    res.status(200).json({ success: true, data: result });
  },

  /** GET /comms/conversations/:conversationId/messages */
  getMessages: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { conversationId } = conversationIdParamSchema.parse(req.params);
    const query = GetMessagesQuerySchema.parse(req.query);
    const result = await commsService.getMessages(req.user, conversationId, query);
    res.status(200).json({ success: true, data: result });
  },

  /** POST /comms/conversations/:conversationId/messages */
  sendMessage: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { conversationId } = conversationIdParamSchema.parse(req.params);
    const body = SendDirectMessageSchema.parse(req.body);
    const result = await commsService.sendDirectMessage(req.user, conversationId, body);
    res.status(201).json({ success: true, data: result });
  },

  /** PATCH /comms/messages/:messageId/read */
  markMessageRead: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { messageId } = messageIdParamSchema.parse(req.params);
    await commsService.markMessageRead(req.user, messageId);
    res.status(200).json({ success: true, data: null });
  },

  /** DELETE /comms/messages/:messageId */
  deleteMessage: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { messageId } = messageIdParamSchema.parse(req.params);
    await commsService.deleteMessage(req.user, messageId);
    res.status(200).json({ success: true, data: null });
  },

  // ─── Broadcasts ────────────────────────────────────────────────────────────

  /** GET /comms/broadcasts */
  getBroadcasts: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = ListQuerySchema.parse(req.query);
    const result = await commsService.getBroadcasts(req.user, query);
    res.status(200).json({ success: true, data: result.broadcasts, pagination: result.pagination });
  },

  /** POST /comms/broadcasts */
  sendBroadcast: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const body = SendBroadcastSchema.parse(req.body);
    const result = await commsService.sendBroadcast(req.user, body);
    res.status(201).json({ success: true, data: result });
  },

  /** GET /comms/broadcasts/:broadcastId */
  getBroadcastDetail: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { broadcastId } = broadcastIdParamSchema.parse(req.params);
    const result = await commsService.getBroadcastDetail(req.user, broadcastId);
    res.status(200).json({ success: true, data: result });
  },

  /** PATCH /comms/broadcasts/:broadcastId/read */
  markBroadcastRead: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { broadcastId } = broadcastIdParamSchema.parse(req.params);
    await commsService.markBroadcastRead(req.user, broadcastId);
    res.status(200).json({ success: true, data: null });
  },

  /** PATCH /comms/broadcasts/:broadcastId/acknowledge */
  acknowledgeBroadcast: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { broadcastId } = broadcastIdParamSchema.parse(req.params);
    await commsService.acknowledgeBroadcast(req.user, broadcastId);
    res.status(200).json({ success: true, data: null });
  },

  /** GET /comms/broadcasts/:broadcastId/status */
  getBroadcastStatus: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { broadcastId } = broadcastIdParamSchema.parse(req.params);
    const result = await commsService.getBroadcastRecipientStatuses(req.user, broadcastId);
    res.status(200).json({ success: true, data: result });
  },

  // ─── Formal Notices ────────────────────────────────────────────────────────

  /** GET /comms/notices */
  getNotices: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = ListQuerySchema.parse(req.query);
    const result = await commsService.getNotices(req.user, query);
    res.status(200).json({ success: true, data: result.notices, pagination: result.pagination });
  },

  /** POST /comms/notices */
  issueNotice: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const body = IssueNoticeSchema.parse(req.body);
    const result = await commsService.issueFormalNotice(req.user, body);
    res.status(201).json({ success: true, data: result });
  },

  /** GET /comms/notices/:noticeId */
  getNoticeDetail: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { noticeId } = noticeIdParamSchema.parse(req.params);
    const result = await commsService.getNoticeDetail(req.user, noticeId);
    res.status(200).json({ success: true, data: result });
  },

  /** PATCH /comms/notices/:noticeId/acknowledge */
  acknowledgeNotice: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { noticeId } = noticeIdParamSchema.parse(req.params);
    await commsService.acknowledgeNotice(req.user, noticeId);
    res.status(200).json({ success: true, data: null });
  },

  /** GET /comms/notices/:noticeId/status */
  getNoticeStatus: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { noticeId } = noticeIdParamSchema.parse(req.params);
    const result = await commsService.getNoticeRecipientStatuses(req.user, noticeId);
    res.status(200).json({ success: true, data: result });
  },
};
