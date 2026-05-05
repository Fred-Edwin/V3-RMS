import { prisma } from '../config/database';
import type { UserRole } from '@prisma/client';

// ─── Shared selects ────────────────────────────────────────────────────────

const participantSelect = { id: true, name: true, role: true } as const;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  sender: { select: { id: true, name: true } },
  bodyHtml: true,
  attachmentUrl: true,
  attachmentName: true,
  readAt: true,
  createdAt: true,
  deletedAt: true,
} as const;

// ─── Direct Conversations ──────────────────────────────────────────────────

export const commsRepository = {
  // Upsert conversation — caller must ensure aId < bId lexicographically
  findOrCreateConversation: async (
    organizationId: string,
    participantAId: string,
    participantBId: string,
  ) => {
    return prisma.directConversation.upsert({
      where: {
        organizationId_participantAId_participantBId: {
          organizationId,
          participantAId,
          participantBId,
        },
      },
      create: { organizationId, participantAId, participantBId },
      update: {},
      include: {
        participantA: { select: participantSelect },
        participantB: { select: participantSelect },
      },
    });
  },

  findConversationById: async (id: string, organizationId?: string | null) => {
    return prisma.directConversation.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: {
        participantA: { select: participantSelect },
        participantB: { select: participantSelect },
      },
    });
  },

  // Used for DIRECTOR who has no organizationId — queries all orgs
  findConversationsByUserAnyOrg: async (
    userId: string,
    limit: number,
    cursor?: string,
  ) => {
    return prisma.directConversation.findMany({
      where: {
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      include: {
        participantA: { select: participantSelect },
        participantB: { select: participantSelect },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: messageSelect,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  },

  // Look up a user's organizationId — used when DIRECTOR creates a conversation
  findUserOrganizationId: async (userId: string): Promise<string | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId ?? null;
  },

  findFirstOrganizationId: async (): Promise<string | null> => {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    return org?.id ?? null;
  },

  findConversationsByUser: async (
    userId: string,
    organizationId: string,
    limit: number,
    cursor?: string,
  ) => {
    return prisma.directConversation.findMany({
      where: {
        organizationId,
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      include: {
        participantA: { select: participantSelect },
        participantB: { select: participantSelect },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: messageSelect,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  },

  countUnreadInConversation: async (conversationId: string, userId: string, organizationId: string) => {
    return prisma.directMessage.count({
      where: {
        conversationId,
        organizationId,
        senderId: { not: userId },
        readAt: null,
        deletedAt: null,
      },
    });
  },

  createDirectMessage: async (data: {
    conversationId: string;
    organizationId: string;
    senderId: string;
    bodyHtml: string;
    attachmentUrl?: string;
    attachmentName?: string;
  }) => {
    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId: data.conversationId,
          organizationId: data.organizationId,
          senderId: data.senderId,
          bodyHtml: data.bodyHtml,
          attachmentUrl: data.attachmentUrl ?? null,
          attachmentName: data.attachmentName ?? null,
        },
        include: { sender: { select: participantSelect } },
      }),
      prisma.directConversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  },

  findMessagesByConversation: async (
    conversationId: string,
    organizationId: string,
    limit: number,
    beforeId?: string,
  ) => {
    let cursor = undefined;
    if (beforeId) {
      cursor = { id: beforeId };
    }
    return prisma.directMessage.findMany({
      where: { conversationId, organizationId },
      include: { sender: { select: participantSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor } : {}),
    });
  },

  markMessageRead: async (messageId: string, viewerId: string) => {
    // Fetch first so we can return senderId + conversationId for socket emit
    const msg = await prisma.directMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, readAt: true },
    });
    if (!msg || msg.senderId === viewerId || msg.readAt) return null;
    const readAt = new Date();
    await prisma.directMessage.update({
      where: { id: messageId },
      data: { readAt },
    });
    return { senderId: msg.senderId, conversationId: msg.conversationId, readAt };
  },

  softDeleteMessage: async (messageId: string, senderId: string) => {
    return prisma.directMessage.updateMany({
      where: { id: messageId, senderId },
      data: { deletedAt: new Date() },
    });
  },

  // ─── Broadcasts ────────────────────────────────────────────────────────

  findUsersForBroadcastScope: async (
    scope: 'COMPANY' | 'BRANCH' | 'ROLE_GROUP',
    organizationId: string,
    targetRole?: UserRole,
    hubOrganizationIds?: string[],
  ): Promise<Array<{ id: string; fcmToken: string | null }>> => {
    if (scope === 'COMPANY' && hubOrganizationIds && hubOrganizationIds.length > 0) {
      return prisma.user.findMany({
        where: {
          organizationId: { in: hubOrganizationIds },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, fcmToken: true },
      });
    }
    if (scope === 'BRANCH') {
      return prisma.user.findMany({
        where: { organizationId, isActive: true, deletedAt: null },
        select: { id: true, fcmToken: true },
      });
    }
    // ROLE_GROUP
    return prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        ...(targetRole ? { role: targetRole } : {}),
      },
      select: { id: true, fcmToken: true },
    });
  },

  createBroadcast: async (
    data: {
      organizationId: string;
      senderId: string;
      scope: 'COMPANY' | 'BRANCH' | 'ROLE_GROUP';
      targetRole?: UserRole;
      subject: string;
      bodyHtml: string;
      attachmentUrl?: string;
      attachmentName?: string;
      requiresAck: boolean;
    },
    recipientIds: string[],
  ) => {
    const broadcast = await prisma.$transaction(async (tx) => {
      const b = await tx.broadcast.create({
        data: {
          organizationId: data.organizationId,
          senderId: data.senderId,
          scope: data.scope,
          targetRole: data.targetRole ?? null,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          attachmentUrl: data.attachmentUrl ?? null,
          attachmentName: data.attachmentName ?? null,
          requiresAck: data.requiresAck,
        },
        include: { sender: { select: participantSelect } },
      });
      if (recipientIds.length > 0) {
        await tx.broadcastRecipient.createMany({
          data: recipientIds.map((userId) => ({
            broadcastId: b.id,
            organizationId: data.organizationId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      return b;
    });
    return broadcast;
  },

  findBroadcastById: async (id: string, organizationId: string | null | undefined, viewerId?: string) => {
    // No org filter for Director (null org) — they can view any broadcast by id.
    // For org-scoped users: allow own org's broadcasts OR COMPANY-scoped broadcasts
    // where viewer is sender or recipient.
    const orgFilter = organizationId
      ? {
          OR: [
            { organizationId },
            {
              scope: 'COMPANY' as const,
              OR: viewerId
                ? [{ senderId: viewerId }, { recipients: { some: { userId: viewerId } } }]
                : [{ senderId: '' }], // unreachable fallback
            },
          ],
        }
      : {};
    const broadcast = await prisma.broadcast.findFirst({
      where: { id, ...orgFilter },
      include: {
        sender: { select: participantSelect },
        _count: { select: { recipients: true } },
      },
    });
    if (!broadcast) return null;

    const readCount = await prisma.broadcastRecipient.count({
      where: { broadcastId: id, readAt: { not: null } },
    });
    const ackCount = await prisma.broadcastRecipient.count({
      where: { broadcastId: id, acknowledgedAt: { not: null } },
    });
    let myRecipient = null;
    if (viewerId) {
      myRecipient = await prisma.broadcastRecipient.findUnique({
        where: { broadcastId_userId: { broadcastId: id, userId: viewerId } },
      });
    }
    return { broadcast, readCount, ackCount, myRecipient };
  },

  findBroadcastsByOrganization: async (
    organizationId: string,
    page: number,
    perPage: number,
    viewerId?: string,
  ) => {
    const skip = (page - 1) * perPage;
    // Show broadcasts that belong to this org OR COMPANY-scoped broadcasts
    // where the viewer is explicitly a recipient (handles Director fan-out across orgs)
    const where = viewerId
      ? {
          OR: [
            { organizationId },
            {
              scope: 'COMPANY' as const,
              recipients: { some: { userId: viewerId } },
            },
          ],
        }
      : { organizationId };

    const [total, broadcasts] = await Promise.all([
      prisma.broadcast.count({ where }),
      prisma.broadcast.findMany({
        where,
        include: {
          sender: { select: participantSelect },
          _count: { select: { recipients: true } },
          recipients: viewerId
            ? { where: { userId: viewerId }, select: { readAt: true, acknowledgedAt: true } }
            : false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);
    return { total, broadcasts };
  },

  // Used for DIRECTOR / HR_MANAGER (no organizationId) — shows ALL broadcasts company-wide,
  // regardless of which branch sent them or who the sender was.
  findBroadcastsForDirector: async (
    _actorId: string,
    page: number,
    perPage: number,
  ) => {
    const skip = (page - 1) * perPage;
    const [total, broadcasts] = await Promise.all([
      prisma.broadcast.count({}),
      prisma.broadcast.findMany({
        include: {
          sender: { select: participantSelect },
          _count: { select: { recipients: true } },
          recipients: false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);
    return { total, broadcasts };
  },

  // Used for DIRECTOR / HR_MANAGER (no organizationId) — shows ALL formal notices company-wide,
  // regardless of which branch issued them or who the issuer was.
  findNoticesForDirector: async (
    _actorId: string,
    page: number,
    perPage: number,
  ) => {
    const skip = (page - 1) * perPage;
    const [total, notices] = await Promise.all([
      prisma.formalNotice.count({}),
      prisma.formalNotice.findMany({
        include: {
          issuer: { select: participantSelect },
          _count: { select: { recipients: true } },
          recipients: false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);
    return { total, notices };
  },

  markBroadcastRead: async (broadcastId: string, userId: string) => {
    // Use upsert-style update; only update if not already read
    const existing = await prisma.broadcastRecipient.findUnique({
      where: { broadcastId_userId: { broadcastId, userId } },
      include: {
        broadcast: { select: { senderId: true } },
        user: { select: { name: true } },
      },
    });
    if (!existing || existing.readAt) return null;
    const readAt = new Date();
    await prisma.broadcastRecipient.update({
      where: { broadcastId_userId: { broadcastId, userId } },
      data: { readAt },
    });
    return {
      senderId: existing.broadcast.senderId,
      userName: existing.user.name,
      readAt,
    };
  },

  acknowledgeBroadcast: async (broadcastId: string, userId: string) => {
    const existing = await prisma.broadcastRecipient.findUnique({
      where: { broadcastId_userId: { broadcastId, userId } },
      include: {
        broadcast: { select: { senderId: true } },
        user: { select: { name: true } },
      },
    });
    if (!existing || existing.acknowledgedAt) return null;
    const acknowledgedAt = new Date();
    await prisma.broadcastRecipient.update({
      where: { broadcastId_userId: { broadcastId, userId } },
      data: {
        acknowledgedAt,
        readAt: existing.readAt ?? acknowledgedAt, // also mark read if not yet
      },
    });
    return {
      senderId: existing.broadcast.senderId,
      userName: existing.user.name,
      acknowledgedAt,
    };
  },

  findBroadcastRecipientStatuses: async (broadcastId: string) => {
    return prisma.broadcastRecipient.findMany({
      where: { broadcastId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  // ─── Formal Notices ────────────────────────────────────────────────────

  createFormalNotice: async (
    data: {
      organizationId: string;
      issuerId: string;
      subject: string;
      bodyHtml: string;
      attachmentUrl?: string;
      attachmentName?: string;
    },
    recipientIds: string[],
  ) => {
    return prisma.$transaction(async (tx) => {
      const notice = await tx.formalNotice.create({
        data: {
          organizationId: data.organizationId,
          issuerId: data.issuerId,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          attachmentUrl: data.attachmentUrl ?? null,
          attachmentName: data.attachmentName ?? null,
        },
        include: { issuer: { select: participantSelect } },
      });
      if (recipientIds.length > 0) {
        await tx.formalNoticeRecipient.createMany({
          data: recipientIds.map((userId) => ({
            noticeId: notice.id,
            organizationId: data.organizationId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      return notice;
    });
  },

  findNoticeById: async (id: string, organizationId: string | null | undefined, viewerId?: string) => {
    const notice = await prisma.formalNotice.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: {
        issuer: { select: participantSelect },
        _count: { select: { recipients: true } },
      },
    });
    if (!notice) return null;

    const ackCount = await prisma.formalNoticeRecipient.count({
      where: { noticeId: id, acknowledgedAt: { not: null } },
    });
    let myRecipient = null;
    if (viewerId) {
      myRecipient = await prisma.formalNoticeRecipient.findUnique({
        where: { noticeId_userId: { noticeId: id, userId: viewerId } },
      });
    }
    return { notice, ackCount, myRecipient };
  },

  findNoticesByOrganization: async (
    organizationId: string,
    page: number,
    perPage: number,
    viewerId?: string,
  ) => {
    const skip = (page - 1) * perPage;
    // A staff member should only see notices where they are the issuer OR an explicit recipient.
    const where = viewerId
      ? {
          organizationId,
          OR: [
            { issuerId: viewerId },
            { recipients: { some: { userId: viewerId } } },
          ],
        }
      : { organizationId };

    const [total, notices] = await Promise.all([
      prisma.formalNotice.count({ where }),
      prisma.formalNotice.findMany({
        where,
        include: {
          issuer: { select: participantSelect },
          _count: { select: { recipients: true } },
          recipients: viewerId
            ? { where: { userId: viewerId }, select: { acknowledgedAt: true } }
            : false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);
    return { total, notices };
  },

  acknowledgeNotice: async (noticeId: string, userId: string) => {
    const existing = await prisma.formalNoticeRecipient.findUnique({
      where: { noticeId_userId: { noticeId, userId } },
      include: {
        notice: { select: { issuerId: true } },
        user: { select: { name: true } },
      },
    });
    if (!existing || existing.acknowledgedAt) return null;
    const acknowledgedAt = new Date();
    await prisma.formalNoticeRecipient.update({
      where: { noticeId_userId: { noticeId, userId } },
      data: { acknowledgedAt },
    });
    return {
      issuerId: existing.notice.issuerId,
      userName: existing.user.name,
      acknowledgedAt,
    };
  },

  findUnacknowledgedAfter24h: async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return prisma.formalNoticeRecipient.findMany({
      where: {
        acknowledgedAt: null,
        reminder24SentAt: null,
        createdAt: { lt: cutoff },
      },
      include: {
        notice: { select: { id: true, subject: true, organizationId: true } },
        user: { select: { id: true, fcmToken: true } },
      },
    });
  },

  findUnacknowledgedAfter48h: async () => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    return prisma.formalNoticeRecipient.findMany({
      where: {
        acknowledgedAt: null,
        escalation48SentAt: null,
        createdAt: { lt: cutoff },
      },
      include: {
        notice: { select: { id: true, subject: true, organizationId: true } },
        user: { select: { id: true } },
      },
    });
  },

  markReminder24Sent: async (recipientId: string) => {
    return prisma.formalNoticeRecipient.update({
      where: { id: recipientId },
      data: { reminder24SentAt: new Date() },
    });
  },

  markEscalation48Sent: async (recipientId: string) => {
    return prisma.formalNoticeRecipient.update({
      where: { id: recipientId },
      data: { escalation48SentAt: new Date() },
    });
  },

  findNoticeRecipientStatuses: async (noticeId: string) => {
    return prisma.formalNoticeRecipient.findMany({
      where: { noticeId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  findDirectorsForOrg: async (
    organizationId: string,
  ): Promise<Array<{ id: string; fcmToken: string | null }>> => {
    // Directors have nullable organizationId or match this org's hub
    return prisma.user.findMany({
      where: {
        role: 'DIRECTOR',
        isActive: true,
        deletedAt: null,
        OR: [{ organizationId }, { organizationId: null }],
      },
      select: { id: true, fcmToken: true },
    });
  },

  // Used to check if user is participant in a conversation
  findConversationParticipant: async (conversationId: string, userId: string) => {
    return prisma.directConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
    });
  },

  // Check if user is a recipient of a broadcast
  findBroadcastRecipient: async (broadcastId: string, userId: string) => {
    return prisma.broadcastRecipient.findUnique({
      where: { broadcastId_userId: { broadcastId, userId } },
    });
  },

  // Check if user is a recipient of a notice
  findNoticeRecipient: async (noticeId: string, userId: string) => {
    return prisma.formalNoticeRecipient.findUnique({
      where: { noticeId_userId: { noticeId, userId } },
    });
  },

  findBroadcastSender: async (broadcastId: string) => {
    return prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { senderId: true, organizationId: true },
    });
  },

  findNoticeSender: async (noticeId: string) => {
    return prisma.formalNotice.findUnique({
      where: { id: noticeId },
      select: { issuerId: true, organizationId: true },
    });
  },

  findAllActiveOrganizationIds: async (): Promise<string[]> => {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return orgs.map((o) => o.id);
  },
};
