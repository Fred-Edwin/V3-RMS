import type { Request } from 'express';
import type { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commsRepository } from '../repositories/comms-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { commsService } from './comms-service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../repositories/comms-repository', () => ({
  commsRepository: {
    findOrCreateConversation: vi.fn(),
    findConversationById: vi.fn(),
    findConversationsByUser: vi.fn(),
    findMessagesByConversation: vi.fn(),
    findConversationParticipant: vi.fn(),
    createDirectMessage: vi.fn(),
    markMessageRead: vi.fn(),
    softDeleteMessage: vi.fn(),
    countUnreadInConversation: vi.fn(),
    findUserOrganizationId: vi.fn(),
    findFirstOrganizationId: vi.fn(),
    findAllActiveOrganizationIds: vi.fn().mockResolvedValue(['org-1']),
    findUsersForBroadcastScope: vi.fn(),
    createBroadcast: vi.fn(),
    findBroadcastById: vi.fn(),
    findBroadcastsByOrganization: vi.fn(),
    markBroadcastRead: vi.fn(),
    acknowledgeBroadcast: vi.fn(),
    findBroadcastRecipient: vi.fn(),
    findBroadcastSender: vi.fn(),
    findBroadcastRecipientStatuses: vi.fn(),
    createFormalNotice: vi.fn(),
    findNoticeById: vi.fn(),
    findNoticesByOrganization: vi.fn(),
    acknowledgeNotice: vi.fn(),
    findNoticeRecipient: vi.fn(),
    findNoticeSender: vi.fn(),
    findNoticeRecipientStatuses: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitNewDirectMessage: vi.fn(),
    emitNewBroadcast: vi.fn(),
    emitNewFormalNotice: vi.fn(),
    emitNewFormalNoticeToUser: vi.fn(),
    emitNoticeAcknowledged: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendDirectMessagePush: vi.fn(),
    sendBroadcastPush: vi.fn(),
    sendFormalNoticePush: vi.fn(),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const waiterActor = {
  id: 'waiter-1',
  name: 'Alice Waiter',
  role: 'WAITER',
  organizationId: 'org-1',
} as NonNullable<Request['user']>;

const managerActor = {
  id: 'manager-1',
  name: 'Bob Manager',
  role: 'MANAGER',
  organizationId: 'org-1',
} as NonNullable<Request['user']>;

const directorActor = {
  id: 'director-1',
  name: 'Carol Director',
  role: 'DIRECTOR',
  organizationId: null,
} as NonNullable<Request['user']>;

const directorWithOrgActor = {
  id: 'director-2',
  name: 'Dave Director',
  role: 'DIRECTOR',
  organizationId: 'org-1',
} as NonNullable<Request['user']>;

const NOW = new Date('2026-04-11T10:00:00.000Z');

const makeConversation = (overrides = {}) => ({
  id: 'conv-1',
  organizationId: 'org-1',
  participantAId: 'manager-1',
  participantBId: 'waiter-1',
  createdAt: NOW,
  updatedAt: NOW,
  participantA: { id: 'manager-1', name: 'Bob Manager', role: 'MANAGER' as UserRole },
  participantB: { id: 'waiter-1', name: 'Alice Waiter', role: 'WAITER' as UserRole },
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  organizationId: 'org-1',
  senderId: 'manager-1',
  sender: { id: 'manager-1', name: 'Bob Manager', role: 'MANAGER' as UserRole },
  bodyHtml: '<p>Hello</p>',
  attachmentUrl: null,
  attachmentName: null,
  readAt: null,
  createdAt: NOW,
  deletedAt: null,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Conversation normalisation ────────────────────────────────────────────────

describe('getOrCreateConversation', () => {
  it('normalises the pair so participantAId < participantBId regardless of who initiates', async () => {
    const conv = makeConversation();
    vi.mocked(commsRepository.findOrCreateConversation).mockResolvedValue(conv);

    // 'manager-1' > 'waiter-1' lexicographically, so order should swap
    await commsService.getOrCreateConversation(
      { ...managerActor, id: 'zzz-manager' },
      { recipientId: 'aaa-waiter' },
    );

    const call = vi.mocked(commsRepository.findOrCreateConversation).mock.calls[0];
    expect(call).toBeDefined();
    const [, aId, bId] = call!;
    expect(aId < bId).toBe(true);
  });

  it('throws ValidationError when sender tries to DM themselves', async () => {
    await expect(
      commsService.getOrCreateConversation(waiterActor, { recipientId: waiterActor.id }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ForbiddenError when actor has no organizationId and none can be resolved', async () => {
    vi.mocked(commsRepository.findUserOrganizationId).mockResolvedValue(null);
    vi.mocked(commsRepository.findFirstOrganizationId).mockResolvedValue(null);
    await expect(
      commsService.getOrCreateConversation(directorActor, { recipientId: 'other-user' }),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ── sendDirectMessage — emits socket + FCM ────────────────────────────────────

describe('sendDirectMessage', () => {
  it('emits socket event and queues FCM push after DB write', async () => {
    const conv = makeConversation();
    const msg = makeMessage();
    vi.mocked(commsRepository.findConversationById).mockResolvedValue(conv);
    vi.mocked(commsRepository.createDirectMessage).mockResolvedValue(msg);

    await commsService.sendDirectMessage(managerActor, 'conv-1', {
      bodyHtml: '<p>Hello</p>',
    });

    expect(socketService.emitNewDirectMessage).toHaveBeenCalledOnce();
    expect(socketService.emitNewDirectMessage).toHaveBeenCalledWith(
      'waiter-1',
      expect.objectContaining({ conversationId: 'conv-1' }),
    );
    expect(fcmService.sendDirectMessagePush).toHaveBeenCalledOnce();
  });

  it('throws ForbiddenError when actor is not a participant', async () => {
    const conv = makeConversation({ participantAId: 'other-a', participantBId: 'other-b' });
    vi.mocked(commsRepository.findConversationById).mockResolvedValue(conv);

    await expect(
      commsService.sendDirectMessage(managerActor, 'conv-1', {
        bodyHtml: '<p>Hi</p>',
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ── sendBroadcast — scope permission matrix ───────────────────────────────────

describe('sendBroadcast', () => {
  const makeBroadcast = () => ({
    id: 'bc-1',
    organizationId: 'org-1',
    senderId: 'manager-1',
    scope: 'BRANCH' as const,
    targetRole: null,
    subject: 'Test',
    bodyHtml: '<p>Test</p>',
    attachmentUrl: null,
    attachmentName: null,
    requiresAck: false,
    createdAt: NOW,
    sender: { id: 'manager-1', name: 'Bob Manager', role: 'MANAGER' as UserRole },
  });

  it('throws ForbiddenError when MANAGER tries COMPANY scope', async () => {
    await expect(
      commsService.sendBroadcast(managerActor, {
        scope: 'COMPANY',
        subject: 'Company-wide',
        bodyHtml: '<p>Hi all</p>',
        requiresAck: false,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when MANAGER targets a different branch', async () => {
    await expect(
      commsService.sendBroadcast(managerActor, {
        scope: 'BRANCH',
        targetBranchId: 'org-2', // different branch
        subject: 'Cross-branch',
        bodyHtml: '<p>Hi</p>',
        requiresAck: false,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows MANAGER to send BRANCH-scoped broadcast to own branch', async () => {
    vi.mocked(commsRepository.findUsersForBroadcastScope).mockResolvedValue([
      { id: 'waiter-1', fcmToken: null },
    ]);
    vi.mocked(commsRepository.createBroadcast).mockResolvedValue(makeBroadcast());

    await expect(
      commsService.sendBroadcast(managerActor, {
        scope: 'BRANCH',
        subject: 'Branch update',
        bodyHtml: '<p>Update</p>',
        requiresAck: false,
      }),
    ).resolves.toBeDefined();

    expect(socketService.emitNewBroadcast).toHaveBeenCalledOnce();
    expect(fcmService.sendBroadcastPush).toHaveBeenCalledOnce();
  });

  it('allows DIRECTOR to send COMPANY-scoped broadcast', async () => {
    vi.mocked(commsRepository.findUsersForBroadcastScope).mockResolvedValue([
      { id: 'waiter-1', fcmToken: null },
    ]);
    vi.mocked(commsRepository.createBroadcast).mockResolvedValue({
      ...makeBroadcast(),
      scope: 'COMPANY',
      sender: { id: 'director-2', name: 'Dave Director', role: 'DIRECTOR' as UserRole },
    });

    await expect(
      commsService.sendBroadcast(directorWithOrgActor, {
        scope: 'COMPANY',
        subject: 'Company news',
        bodyHtml: '<p>News</p>',
        requiresAck: false,
      }),
    ).resolves.toBeDefined();
  });
});

// ── acknowledgeNotice — recipient validation ──────────────────────────────────

describe('acknowledgeNotice', () => {
  it('throws NotFoundError when user is not a recipient of the notice', async () => {
    vi.mocked(commsRepository.findNoticeRecipient).mockResolvedValue(null);

    await expect(
      commsService.acknowledgeNotice(waiterActor, 'notice-1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('calls acknowledgeNotice repo method when user is a valid recipient', async () => {
    vi.mocked(commsRepository.findNoticeRecipient).mockResolvedValue({
      id: 'fnr-1',
      noticeId: 'notice-1',
      organizationId: 'org-1',
      userId: 'waiter-1',
      acknowledgedAt: null,
      reminder24SentAt: null,
      escalation48SentAt: null,
      createdAt: NOW,
    });
    vi.mocked(commsRepository.acknowledgeNotice).mockResolvedValue({ issuerId: 'director-1', userName: 'Test Waiter', acknowledgedAt: NOW });

    await commsService.acknowledgeNotice(waiterActor, 'notice-1');

    expect(commsRepository.acknowledgeNotice).toHaveBeenCalledWith('notice-1', 'waiter-1');
  });
});

// ── deleteMessage — sender-only guard ─────────────────────────────────────────

describe('deleteMessage', () => {
  it('throws ForbiddenError when message not found or sender mismatch', async () => {
    vi.mocked(commsRepository.softDeleteMessage).mockResolvedValue({ count: 0 });

    await expect(commsService.deleteMessage(waiterActor, 'msg-999')).rejects.toThrow(ForbiddenError);
  });
});
