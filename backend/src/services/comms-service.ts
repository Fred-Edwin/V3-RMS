import type { Request } from 'express';
import { commsRepository } from '../repositories/comms-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  DirectConversationRecord,
  DirectMessageRecord,
  BroadcastRecord,
  BroadcastRecipientStatusRecord,
  FormalNoticeRecord,
  FormalNoticeRecipientStatusRecord,
  PaginationMeta,
} from '../types/comms.types';
import type {
  SendDirectMessageInput,
  GetOrCreateConversationInput,
  GetMessagesQueryInput,
  GetConversationsQueryInput,
  SendBroadcastInput,
  IssueNoticeInput,
  ListQueryInput,
} from '../validators/comms-schemas';

type Actor = NonNullable<Request['user']>;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Normalise a pair so participantAId < participantBId (lexicographic). */
function normalisePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Strip HTML tags for push notification preview text. */
function stripHtml(html: string, maxLen = 80): string {
  return html.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

function serializeMessage(
  raw: {
    id: string;
    conversationId: string;
    senderId: string;
    sender: { id: string; name: string; role: string };
    bodyHtml: string;
    attachmentUrl: string | null;
    attachmentName: string | null;
    readAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
  },
): DirectMessageRecord {
  const isDeleted = raw.deletedAt !== null;
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    senderName: raw.sender.name,
    bodyHtml: isDeleted ? '<em>[deleted]</em>' : raw.bodyHtml,
    attachmentUrl: isDeleted ? null : raw.attachmentUrl,
    attachmentName: isDeleted ? null : raw.attachmentName,
    readAt: raw.readAt?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    isDeleted,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────

export const commsService = {
  // ── Direct Conversations ────────────────────────────────────────────────

  getConversations: async (
    actor: Actor,
    query: GetConversationsQueryInput,
  ): Promise<{ conversations: DirectConversationRecord[]; nextCursor: string | null }> => {
    const rows = actor.siteId
      ? await commsRepository.findConversationsByUser(actor.id, actor.siteId, query.limit, query.cursor)
      : await commsRepository.findConversationsByUserAnyOrg(actor.id, query.limit, query.cursor);

    const conversations: DirectConversationRecord[] = await Promise.all(
      rows.map(async (row) => {
        const other =
          row.participantAId === actor.id ? row.participantB : row.participantA;
        const unreadCount = await commsRepository.countUnreadInConversation(row.id, actor.id, row.siteId);
        const lastMsg = row.messages[0] ?? null;
        return {
          id: row.id,
          siteId: row.siteId,
          otherParticipant: { id: other.id, name: other.name, role: other.role },
          lastMessage: lastMsg ? serializeMessage(lastMsg as Parameters<typeof serializeMessage>[0]) : null,
          unreadCount,
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    );

    const lastRow = rows[rows.length - 1];
    const nextCursor = rows.length === query.limit && lastRow ? lastRow.id : null;
    return { conversations, nextCursor };
  },

  getOrCreateConversation: async (
    actor: Actor,
    input: GetOrCreateConversationInput,
  ): Promise<DirectConversationRecord> => {
    if (input.recipientId === actor.id) {
      throw new ValidationError('Cannot start a conversation with yourself');
    }

    // Resolve org: use actor's org, else recipient's org, else any org (for
    // cross-branch users like DIRECTOR ↔ ACCOUNTANT who both have no branch).
    let orgId = actor.siteId;
    if (!orgId) {
      orgId = await commsRepository.findUserSiteId(input.recipientId);
    }
    if (!orgId) {
      // Both users are unscoped (e.g. DIRECTOR ↔ ACCOUNTANT) — use any org as
      // the conversation container since DMs require an org scope in the schema.
      orgId = await commsRepository.findFirstSiteId();
    }
    if (!orgId) throw new ForbiddenError('Cannot determine organization for this conversation');

    const [aId, bId] = normalisePair(actor.id, input.recipientId);
    const row = await commsRepository.findOrCreateConversation(
      orgId,
      aId,
      bId,
    );

    const other = row.participantAId === actor.id ? row.participantB : row.participantA;
    return {
      id: row.id,
      siteId: row.siteId,
      otherParticipant: { id: other.id, name: other.name, role: other.role },
      lastMessage: null,
      unreadCount: 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  getMessages: async (
    actor: Actor,
    conversationId: string,
    query: GetMessagesQueryInput,
  ): Promise<DirectMessageRecord[]> => {
    // Verify participant — no org filter needed; participant check is sufficient
    const conv = await commsRepository.findConversationParticipant(conversationId, actor.id);
    if (!conv) throw new NotFoundError('Conversation not found');

    const rows = await commsRepository.findMessagesByConversation(
      conversationId,
      conv.siteId,
      query.limit,
      query.before,
    );
    return rows.map((r) => serializeMessage(r as Parameters<typeof serializeMessage>[0]));
  },

  sendDirectMessage: async (
    actor: Actor,
    conversationId: string,
    input: SendDirectMessageInput,
  ): Promise<DirectMessageRecord> => {
    const conv = await commsRepository.findConversationById(conversationId, actor.siteId);
    if (!conv) throw new NotFoundError('Conversation not found');

    const isParticipant =
      conv.participantAId === actor.id || conv.participantBId === actor.id;
    if (!isParticipant) throw new ForbiddenError('Not a participant in this conversation');

    const recipientId =
      conv.participantAId === actor.id ? conv.participantBId : conv.participantAId;

    const msg = await commsRepository.createDirectMessage({
      conversationId,
      siteId: conv.siteId,
      senderId: actor.id,
      bodyHtml: input.bodyHtml,
      attachmentUrl: input.attachmentUrl,
      attachmentName: input.attachmentName,
    });

    const serialized = serializeMessage(msg as Parameters<typeof serializeMessage>[0]);

    // Real-time delivery
    socketService.emitNewDirectMessage(recipientId, {
      conversationId,
      message: {
        id: serialized.id,
        senderId: serialized.senderId,
        senderName: serialized.senderName,
        bodyHtml: serialized.bodyHtml,
        attachmentUrl: serialized.attachmentUrl,
        attachmentName: serialized.attachmentName,
        createdAt: serialized.createdAt,
      },
    });

    // FCM push (fire-and-forget) — use sender name from the created message record
    void fcmService.sendDirectMessagePush(recipientId, {
      conversationId,
      senderName: msg.sender.name,
      preview: stripHtml(input.bodyHtml),
    });

    logger.info({ conversationId, senderId: actor.id, recipientId }, 'DM sent');
    return serialized;
  },

  markMessageRead: async (actor: Actor, messageId: string): Promise<void> => {
    const result = await commsRepository.markMessageRead(messageId, actor.id);
    if (result) {
      // Notify the original sender so their read receipt turns blue in real-time
      socketService.emitMessageRead(result.senderId, {
        messageId,
        conversationId: result.conversationId,
        readAt: result.readAt.toISOString(),
      });
    }
  },

  deleteMessage: async (actor: Actor, messageId: string): Promise<void> => {
    const result = await commsRepository.softDeleteMessage(messageId, actor.id);
    if (result.count === 0) {
      throw new ForbiddenError('Message not found or you are not the sender');
    }
  },

  // ── Broadcasts ──────────────────────────────────────────────────────────

  getBroadcasts: async (
    actor: Actor,
    query: ListQueryInput,
  ): Promise<{ broadcasts: BroadcastRecord[]; pagination: PaginationMeta }> => {
    const { total, broadcasts } = actor.siteId
      ? await commsRepository.findBroadcastsBySite(actor.siteId, query.page, query.perPage, actor.id)
      : await commsRepository.findBroadcastsForDirector(actor.id, query.page, query.perPage);

    const serialized: BroadcastRecord[] = (broadcasts as Array<typeof broadcasts[number] & { recipients?: Array<{ readAt: Date | null; acknowledgedAt: Date | null }> }>).map((b) => {
      const recipientsArr = b.recipients;
      const myRecipient = Array.isArray(recipientsArr) ? (recipientsArr[0] ?? null) : null;
      return {
        id: b.id,
        siteId: b.siteId,
        sender: { id: b.sender.id, name: b.sender.name },
        scope: b.scope,
        targetRole: b.targetRole,
        subject: b.subject,
        bodyHtml: b.bodyHtml,
        attachmentUrl: b.attachmentUrl,
        attachmentName: b.attachmentName,
        requiresAck: b.requiresAck,
        totalRecipients: b._count.recipients,
        readCount: 0, // populated on detail view
        ackCount: 0,
        myReadAt: myRecipient?.readAt?.toISOString() ?? null,
        myAcknowledgedAt: myRecipient?.acknowledgedAt?.toISOString() ?? null,
        isRecipient: myRecipient !== null,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return {
      broadcasts: serialized,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },

  getBroadcastDetail: async (actor: Actor, broadcastId: string): Promise<BroadcastRecord> => {
    const result = await commsRepository.findBroadcastById(broadcastId, actor.siteId, actor.id);
    if (!result) throw new NotFoundError('Broadcast not found');

    const { broadcast: b, readCount, ackCount, myRecipient } = result;
    return {
      id: b.id,
      siteId: b.siteId,
      sender: { id: b.sender.id, name: b.sender.name },
      scope: b.scope,
      targetRole: b.targetRole,
      subject: b.subject,
      bodyHtml: b.bodyHtml,
      attachmentUrl: b.attachmentUrl,
      attachmentName: b.attachmentName,
      requiresAck: b.requiresAck,
      totalRecipients: b._count.recipients,
      readCount,
      ackCount,
      myReadAt: myRecipient?.readAt?.toISOString() ?? null,
      myAcknowledgedAt: myRecipient?.acknowledgedAt?.toISOString() ?? null,
      isRecipient: myRecipient !== null,
      createdAt: b.createdAt.toISOString(),
    };
  },

  sendBroadcast: async (actor: Actor, input: SendBroadcastInput): Promise<BroadcastRecord> => {
    // DIRECTOR has no organizationId; they must specify a target branch or COMPANY scope
    if (!actor.siteId && input.scope !== 'COMPANY' && !input.targetBranchId) {
      throw new ForbiddenError('Director must specify a target branch or use COMPANY scope');
    }

    // Permission: MANAGER can only send BRANCH or ROLE_GROUP scoped to own branch
    if (actor.role === 'MANAGER' && input.scope === 'COMPANY') {
      throw new ForbiddenError('Managers can only send branch-scoped broadcasts');
    }

    // For COMPANY scope by a Director (no orgId), pick any org as the hub anchor
    // for the broadcast record FK — recipients still fan out across all orgs.
    let targetOrgId = input.targetBranchId ?? actor.siteId ?? '';
    if (!targetOrgId) {
      targetOrgId = (await commsRepository.findFirstSiteId()) ?? '';
    }

    if (actor.role === 'MANAGER' && targetOrgId !== actor.siteId) {
      throw new ForbiddenError('Managers can only send broadcasts to their own branch');
    }

    // For COMPANY scope (DIRECTOR only), fan out to all active orgs
    let hubOrgIds: string[] | undefined;
    if (input.scope === 'COMPANY') {
      const allOrgs = await commsRepository.findAllActiveSiteIds();
      hubOrgIds = allOrgs;
    }

    // Fan-out: snapshot recipients now
    const recipients = await commsRepository.findUsersForBroadcastScope(
      input.scope,
      targetOrgId,
      input.targetRole as Parameters<typeof commsRepository.findUsersForBroadcastScope>[2],
      hubOrgIds,
    );
    const recipientIds = recipients.map((r) => r.id).filter((id) => id !== actor.id);

    const broadcast = await commsRepository.createBroadcast(
      {
        siteId: targetOrgId,
        senderId: actor.id,
        scope: input.scope,
        targetRole: input.targetRole as Parameters<typeof commsRepository.createBroadcast>[0]['targetRole'],
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
        requiresAck: input.requiresAck,
      },
      recipientIds,
    );

    // Real-time delivery to branch room
    socketService.emitNewBroadcast(targetOrgId, {
      broadcastId: broadcast.id,
      subject: broadcast.subject,
      senderName: broadcast.sender.name,
      requiresAck: broadcast.requiresAck,
      createdAt: broadcast.createdAt.toISOString(),
    });

    // FCM push (fire-and-forget)
    void fcmService.sendBroadcastPush(recipientIds, {
      broadcastId: broadcast.id,
      subject: broadcast.subject,
      senderName: broadcast.sender.name,
    });

    logger.info(
      { broadcastId: broadcast.id, senderId: actor.id, recipientCount: recipientIds.length },
      'Broadcast sent',
    );

    return {
      id: broadcast.id,
      siteId: broadcast.siteId,
      sender: { id: broadcast.sender.id, name: broadcast.sender.name },
      scope: broadcast.scope,
      targetRole: broadcast.targetRole,
      subject: broadcast.subject,
      bodyHtml: broadcast.bodyHtml,
      attachmentUrl: broadcast.attachmentUrl,
      attachmentName: broadcast.attachmentName,
      requiresAck: broadcast.requiresAck,
      totalRecipients: recipientIds.length,
      readCount: 0,
      ackCount: 0,
      myReadAt: null,
      myAcknowledgedAt: null,
      isRecipient: false,
      createdAt: broadcast.createdAt.toISOString(),
    };
  },

  markBroadcastRead: async (actor: Actor, broadcastId: string): Promise<void> => {
    const recipient = await commsRepository.findBroadcastRecipient(broadcastId, actor.id);
    // Senders are not in the recipient table — silently skip marking read for them
    if (!recipient) return;
    const result = await commsRepository.markBroadcastRead(broadcastId, actor.id);
    if (result) {
      socketService.emitBroadcastRead(result.senderId, {
        broadcastId,
        userId: actor.id,
        userName: result.userName,
        readAt: result.readAt.toISOString(),
      });
    }
  },

  acknowledgeBroadcast: async (actor: Actor, broadcastId: string): Promise<void> => {
    const recipient = await commsRepository.findBroadcastRecipient(broadcastId, actor.id);
    if (!recipient) throw new NotFoundError('Broadcast not found or you are not a recipient');
    const result = await commsRepository.acknowledgeBroadcast(broadcastId, actor.id);
    if (result) {
      socketService.emitBroadcastAcknowledged(result.senderId, {
        broadcastId,
        userId: actor.id,
        userName: result.userName,
        acknowledgedAt: result.acknowledgedAt.toISOString(),
      });
    }
  },

  getBroadcastRecipientStatuses: async (
    actor: Actor,
    broadcastId: string,
  ): Promise<BroadcastRecipientStatusRecord[]> => {
    const sender = await commsRepository.findBroadcastSender(broadcastId);
    if (!sender) throw new NotFoundError('Broadcast not found');
    if (sender.senderId !== actor.id && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only the sender or a Director can view recipient statuses');
    }
    const rows = await commsRepository.findBroadcastRecipientStatuses(broadcastId);
    return rows.map((r) => ({
      userId: r.userId,
      userName: r.user.name,
      readAt: r.readAt?.toISOString() ?? null,
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    }));
  },

  // ── Formal Notices ──────────────────────────────────────────────────────

  getNotices: async (
    actor: Actor,
    query: ListQueryInput,
  ): Promise<{ notices: FormalNoticeRecord[]; pagination: PaginationMeta }> => {
    const { total, notices } = actor.siteId
      ? await commsRepository.findNoticesBySite(actor.siteId, query.page, query.perPage, actor.id)
      : await commsRepository.findNoticesForDirector(actor.id, query.page, query.perPage);

    const serialized: FormalNoticeRecord[] = (notices as Array<typeof notices[number] & { recipients?: Array<{ acknowledgedAt: Date | null }> }>).map((n) => {
      const recipientsArr2 = n.recipients;
      const myRecipient = Array.isArray(recipientsArr2) ? (recipientsArr2[0] ?? null) : null;
      return {
        id: n.id,
        siteId: n.siteId,
        issuer: { id: n.issuer.id, name: n.issuer.name },
        subject: n.subject,
        bodyHtml: n.bodyHtml,
        attachmentUrl: n.attachmentUrl,
        attachmentName: n.attachmentName,
        totalRecipients: n._count.recipients,
        ackCount: 0,
        myAcknowledgedAt: myRecipient?.acknowledgedAt?.toISOString() ?? null,
        isRecipient: myRecipient !== null,
        createdAt: n.createdAt.toISOString(),
      };
    });

    return {
      notices: serialized,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },

  getNoticeDetail: async (actor: Actor, noticeId: string): Promise<FormalNoticeRecord> => {
    const result = await commsRepository.findNoticeById(noticeId, actor.siteId, actor.id);
    if (!result) throw new NotFoundError('Notice not found');

    const { notice: n, ackCount, myRecipient } = result;
    return {
      id: n.id,
      siteId: n.siteId,
      issuer: { id: n.issuer.id, name: n.issuer.name },
      subject: n.subject,
      bodyHtml: n.bodyHtml,
      attachmentUrl: n.attachmentUrl,
      attachmentName: n.attachmentName,
      totalRecipients: n._count.recipients,
      ackCount,
      myAcknowledgedAt: myRecipient?.acknowledgedAt?.toISOString() ?? null,
      isRecipient: myRecipient !== null,
      createdAt: n.createdAt.toISOString(),
    };
  },

  issueFormalNotice: async (actor: Actor, input: IssueNoticeInput): Promise<FormalNoticeRecord> => {
    let recipientIds: string[];
    let targetOrgId: string;

    if (input.targetUserId) {
      // Individual targeting — one specific staff member
      const userOrgId = await commsRepository.findUserSiteId(input.targetUserId);
      // Use user's org, or if both are null (e.g. Director → Director), fall back to first org
      targetOrgId = userOrgId ?? actor.siteId ?? (await commsRepository.findFirstSiteId()) ?? '';
      if (!targetOrgId) throw new ForbiddenError('Cannot determine organization for notice');
      recipientIds = [input.targetUserId].filter((id) => id !== actor.id);
    } else if (input.allBranches) {
      // All-branches — company-wide notice
      const allOrgIds = await commsRepository.findAllActiveSiteIds();
      if (allOrgIds.length === 0) throw new ForbiddenError('No active branches found');
      // Anchor organizationId to first org (same pattern as COMPANY broadcasts)
      targetOrgId = allOrgIds[0]!;
      const allUsers = await Promise.all(
        allOrgIds.map((orgId) =>
          commsRepository.findUsersForBroadcastScope(
            input.targetRole ? 'ROLE_GROUP' : 'BRANCH',
            orgId,
            input.targetRole as Parameters<typeof commsRepository.findUsersForBroadcastScope>[2],
          ),
        ),
      );
      recipientIds = allUsers.flat().map((r) => r.id).filter((id) => id !== actor.id);
      // Deduplicate (shouldn't be needed but defensive)
      recipientIds = [...new Set(recipientIds)];
    } else {
      // Single branch (original behaviour)
      if (!actor.siteId && !input.targetBranchId) {
        throw new ForbiddenError('Director must specify a target branch when issuing a formal notice');
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      targetOrgId = (input.targetBranchId ?? actor.siteId)!;
      const branchUsers = await commsRepository.findUsersForBroadcastScope(
        input.targetRole ? 'ROLE_GROUP' : 'BRANCH',
        targetOrgId,
        input.targetRole as Parameters<typeof commsRepository.findUsersForBroadcastScope>[2],
      );
      recipientIds = branchUsers.map((r) => r.id).filter((id) => id !== actor.id);
    }

    const notice = await commsRepository.createFormalNotice(
      {
        siteId: targetOrgId,
        issuerId: actor.id,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
      },
      recipientIds,
    );

    // Real-time — emit only to recipients (individual) or the whole branch room (broadcast-style)
    const noticePayload = {
      noticeId: notice.id,
      subject: notice.subject,
      issuerName: notice.issuer.name,
      createdAt: notice.createdAt.toISOString(),
    };
    if (input.targetUserId) {
      // Individual notice — emit only to the recipient's own socket room
      for (const recipientId of recipientIds) socketService.emitNewFormalNoticeToUser(recipientId, noticePayload);
    } else if (input.allBranches) {
      const allOrgIds = await commsRepository.findAllActiveSiteIds();
      for (const orgId of allOrgIds) socketService.emitNewFormalNotice(orgId, noticePayload);
    } else {
      socketService.emitNewFormalNotice(targetOrgId, noticePayload);
    }

    // FCM push (fire-and-forget) — notices are always high priority
    for (const recipientId of recipientIds) {
      void fcmService.sendFormalNoticePush(recipientId, {
        noticeId: notice.id,
        subject: notice.subject,
      });
    }

    logger.info(
      { noticeId: notice.id, issuerId: actor.id, recipientCount: recipientIds.length },
      'Formal notice issued',
    );

    return {
      id: notice.id,
      siteId: notice.siteId,
      issuer: { id: notice.issuer.id, name: notice.issuer.name },
      subject: notice.subject,
      bodyHtml: notice.bodyHtml,
      attachmentUrl: notice.attachmentUrl,
      attachmentName: notice.attachmentName,
      totalRecipients: recipientIds.length,
      ackCount: 0,
      myAcknowledgedAt: null,
      isRecipient: false,
      createdAt: notice.createdAt.toISOString(),
    };
  },

  acknowledgeNotice: async (actor: Actor, noticeId: string): Promise<void> => {
    const recipient = await commsRepository.findNoticeRecipient(noticeId, actor.id);
    if (!recipient) throw new NotFoundError('Notice not found or you are not a recipient');
    const result = await commsRepository.acknowledgeNotice(noticeId, actor.id);
    if (result) {
      socketService.emitNoticeAcknowledged(result.issuerId, {
        noticeId,
        userId: actor.id,
        userName: result.userName,
        acknowledgedAt: result.acknowledgedAt.toISOString(),
      });
    }
  },

  getNoticeRecipientStatuses: async (
    actor: Actor,
    noticeId: string,
  ): Promise<FormalNoticeRecipientStatusRecord[]> => {
    const sender = await commsRepository.findNoticeSender(noticeId);
    if (!sender) throw new NotFoundError('Notice not found');
    if (sender.issuerId !== actor.id && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only the issuer or a Director can view recipient statuses');
    }
    const rows = await commsRepository.findNoticeRecipientStatuses(noticeId);
    return rows.map((r) => ({
      userId: r.userId,
      userName: r.user.name,
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    }));
  },
};
