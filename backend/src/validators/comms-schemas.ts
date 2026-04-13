import { z } from 'zod';

const USER_ROLES = [
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
] as const;

export const SendDirectMessageSchema = z.object({
  bodyHtml: z.string().min(1).max(50_000),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
});

export const GetOrCreateConversationSchema = z.object({
  recipientId: z.string().uuid(),
});

export const GetMessagesQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const GetConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

export const SendBroadcastSchema = z.object({
  scope: z.enum(['COMPANY', 'BRANCH', 'ROLE_GROUP']),
  targetBranchId: z.string().uuid().optional(),
  targetRole: z.enum(USER_ROLES).optional(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(200_000),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
  requiresAck: z.boolean().default(false),
});

export const IssueNoticeSchema = z.object({
  targetBranchId: z.string().uuid().optional(),
  targetRole: z.enum(USER_ROLES).optional(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(200_000),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
});

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendDirectMessageInput = z.infer<typeof SendDirectMessageSchema>;
export type GetOrCreateConversationInput = z.infer<typeof GetOrCreateConversationSchema>;
export type GetMessagesQueryInput = z.infer<typeof GetMessagesQuerySchema>;
export type GetConversationsQueryInput = z.infer<typeof GetConversationsQuerySchema>;
export type SendBroadcastInput = z.infer<typeof SendBroadcastSchema>;
export type IssueNoticeInput = z.infer<typeof IssueNoticeSchema>;
export type ListQueryInput = z.infer<typeof ListQuerySchema>;
