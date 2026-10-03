import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { app } from '../src/app';
import { printService } from '../src/services/print-service';
import { printRepository } from '../src/repositories/print-repository';
import { NotFoundError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

// ─── Auth tokens ──────────────────────────────────────────────────────────────

const waiterToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'WAITER',
  siteId: '22222222-2222-4222-8222-222222222222',
});

const managerToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'MANAGER',
  siteId: '22222222-2222-4222-8222-222222222222',
});

const chefToken = signAccessToken({
  userId: '44444444-4444-4444-8444-444444444444',
  role: 'CHEF',
  siteId: '22222222-2222-4222-8222-222222222222',
});

const orgId = '22222222-2222-4222-8222-222222222222';
const orderId = '55555555-5555-4555-8555-555555555555';
const printJobId = '66666666-6666-4666-8666-666666666666';
const stationId = '77777777-7777-4777-8777-777777777777';

const samplePrintJob = {
  id: printJobId,
  siteId: orgId,
  orderId,
  activeKey: `${orderId}:RECEIPT`,
  receiptType: 'RECEIPT' as const,
  copies: 2,
  status: 'PENDING' as const,
  receiptData: { branchName: 'Wendo Kingz' },
  requestedById: '11111111-1111-4111-8111-111111111111',
  targetStationId: null,
  claimedByStationId: null,
  claimedAt: null,
  leaseExpiresAt: null,
  printAttemptCount: 0,
  printedByStationId: null,
  printedAt: null,
  failureReason: null,
  createdAt: new Date('2026-03-08T10:00:00Z'),
  updatedAt: new Date('2026-03-08T10:00:00Z'),
};

const samplePrintJobSummary = {
  id: printJobId,
  orderId,
  receiptType: 'RECEIPT' as const,
  copies: 2,
  status: 'PENDING' as const,
  targetStationId: null,
  createdAt: new Date('2026-03-08T10:00:00Z'),
};

// Shared paid-order fixture for createPrintJob service tests.
const paidOrderFixture = {
  id: orderId,
  siteId: orgId,
  dailyNumber: 42,
  orderDate: new Date('2026-03-08'),
  type: 'DINE_IN',
  tableNumber: 'T5',
  subtotal: { toString: () => '1200' } as never,
  deliveryFee: { toString: () => '0' } as never,
  total: { toString: () => '1200' } as never,
  paymentMethod: 'CASH',
  paidAt: new Date('2026-03-08T14:32:00Z'),
  createdAt: new Date('2026-03-08T10:00:00Z'),
  site: { name: 'Wendo Kingz' },
  createdBy: { name: 'Jane M.' },
  items: [],
};

const sampleStation = {
  id: stationId,
  siteId: orgId,
  name: 'Counter Printer',
  isActive: true,
  lastSeenAt: null,
  createdAt: new Date('2026-03-08T10:00:00Z'),
  updatedAt: new Date('2026-03-08T10:00:00Z'),
};

// ─── Print Job Tests ──────────────────────────────────────────────────────────

describe('POST /api/v1/print-jobs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a print job for a waiter with a paid order', async () => {
    vi.spyOn(printService, 'createPrintJob').mockResolvedValue(samplePrintJobSummary);

    const res = await request(app)
      .post('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ orderId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(printJobId);
    expect(res.body.message).toBe('Print job created');
  });

  it('returns 400 for invalid orderId', async () => {
    const res = await request(app)
      .post('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ orderId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when order does not exist', async () => {
    vi.spyOn(printService, 'createPrintJob').mockRejectedValue(
      new NotFoundError('Order not found'),
    );

    const res = await request(app)
      .post('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ orderId });

    expect(res.status).toBe(404);
  });

  it('returns 400 when order is not paid', async () => {
    vi.spyOn(printService, 'createPrintJob').mockRejectedValue(
      new ValidationError('Order has not been paid yet — cannot create a print job'),
    );

    const res = await request(app)
      .post('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ orderId });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/print-jobs').send({ orderId });
    expect(res.status).toBe(401);
  });

  it('returns 403 for CHEF role', async () => {
    const res = await request(app)
      .post('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${chefToken}`)
      .send({ orderId });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/print-jobs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns paginated print jobs for manager', async () => {
    vi.spyOn(printService, 'getPrintJobs').mockResolvedValue({
      jobs: [samplePrintJob],
      pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
    });

    const res = await request(app)
      .get('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns 403 for waiter role', async () => {
    const res = await request(app)
      .get('/api/v1/print-jobs')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/print-jobs/:id', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a print job by id for manager', async () => {
    vi.spyOn(printService, 'getPrintJobById').mockResolvedValue(samplePrintJob);

    const res = await request(app)
      .get(`/api/v1/print-jobs/${printJobId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(printJobId);
  });

  it('returns 404 for unknown id', async () => {
    vi.spyOn(printService, 'getPrintJobById').mockRejectedValue(
      new NotFoundError('Print job not found'),
    );

    const res = await request(app)
      .get(`/api/v1/print-jobs/${printJobId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── Print Station Management Tests ──────────────────────────────────────────

describe('POST /api/v1/print-stations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a print station for manager', async () => {
    vi.spyOn(printService, 'createPrintStation').mockResolvedValue({
      id: stationId,
      siteId: orgId,
      name: 'Counter Printer',
      token: 'pst_abc123',
      isActive: true,
      createdAt: new Date('2026-03-08T10:00:00Z'),
      updatedAt: new Date('2026-03-08T10:00:00Z'),
    });

    const res = await request(app)
      .post('/api/v1/print-stations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Counter Printer' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('pst_abc123');
    expect(res.body.message).toContain('Save the token');
  });

  it('returns 403 for waiter role', async () => {
    const res = await request(app)
      .post('/api/v1/print-stations')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Counter Printer' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for missing name', async () => {
    const res = await request(app)
      .post('/api/v1/print-stations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/print-stations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists print stations for manager', async () => {
    vi.spyOn(printService, 'listPrintStations').mockResolvedValue([
      { ...sampleStation, isOnline: false },
    ]);

    const res = await request(app)
      .get('/api/v1/print-stations')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isOnline).toBe(false);
  });
});

describe('DELETE /api/v1/print-stations/:id', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deactivates a station for manager', async () => {
    vi.spyOn(printService, 'deactivatePrintStation').mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/v1/print-stations/${stationId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Print station deactivated');
  });

  it('returns 404 for unknown station', async () => {
    vi.spyOn(printService, 'deactivatePrintStation').mockRejectedValue(
      new NotFoundError('Print station not found'),
    );

    const res = await request(app)
      .delete(`/api/v1/print-stations/${stationId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── Print Station Auth Middleware Tests ──────────────────────────────────────

describe('Print station token auth middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 for missing token on /print-station/jobs', async () => {
    const res = await request(app).get('/api/v1/print-station/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-pst_ prefixed token', async () => {
    const res = await request(app)
      .get('/api/v1/print-station/jobs')
      .set('Authorization', 'Bearer some-jwt-token');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid pst_ token (not in DB)', async () => {
    vi.spyOn(printRepository, 'findPrintStationByTokenHash').mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/print-station/jobs')
      .set('Authorization', 'Bearer pst_invalid_token_123');

    expect(res.status).toBe(401);
  });

  it('returns 401 for inactive station', async () => {
    vi.spyOn(printRepository, 'findPrintStationByTokenHash').mockResolvedValue({
      id: stationId,
      siteId: orgId,
      isActive: false,
    });

    const res = await request(app)
      .get('/api/v1/print-station/jobs')
      .set('Authorization', 'Bearer pst_valid_token');

    expect(res.status).toBe(401);
  });

  it('returns jobs for valid station token', async () => {
    vi.spyOn(printRepository, 'findPrintStationByTokenHash').mockResolvedValue({
      id: stationId,
      siteId: orgId,
      isActive: true,
    });
    vi.spyOn(printService, 'claimJobsForStation').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/print-station/jobs')
      .set('Authorization', 'Bearer pst_valid_token');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─── Print Service Unit Tests ─────────────────────────────────────────────────

describe('printService.createPrintJob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundError when order does not exist', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(null);

    await expect(
      printService.createPrintJob(orderId, 'user-1', orgId),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when order is not paid', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue({
      id: orderId,
      siteId: orgId,
      dailyNumber: 42,
      orderDate: new Date('2026-03-08'),
      type: 'DINE_IN',
      tableNumber: 'T5',
      subtotal: { toString: () => '1200' } as never,
      deliveryFee: { toString: () => '0' } as never,
      total: { toString: () => '1200' } as never,
      paymentMethod: null, // not paid
      paidAt: null,
      createdAt: new Date(),
      site: { name: 'Wendo Kingz' },
      createdBy: { name: 'Jane M.' },
      items: [],
    });

    await expect(
      printService.createPrintJob(orderId, 'user-1', orgId),
    ).rejects.toThrow(ValidationError);
  });

  it('creates print job with correct receipt data snapshot', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue({
      id: orderId,
      siteId: orgId,
      dailyNumber: 42,
      orderDate: new Date('2026-03-08'),
      type: 'DINE_IN',
      tableNumber: 'T5',
      subtotal: { toString: () => '1200' } as never,
      deliveryFee: { toString: () => '0' } as never,
      total: { toString: () => '1200' } as never,
      paymentMethod: 'CASH',
      paidAt: new Date('2026-03-08T14:32:00Z'),
      createdAt: new Date('2026-03-08T10:00:00Z'),
      site: { name: 'Wendo Kingz' },
      createdBy: { name: 'Jane M.' },
      items: [
        {
          quantity: 2,
          unitPrice: { toString: () => '300' } as never,
          subtotal: { toString: () => '600' } as never,
          menuItem: { name: 'Cappuccino' },
        },
      ],
    });

    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(null);
    const createSpy = vi.spyOn(printRepository, 'createPrintJob').mockResolvedValue(samplePrintJobSummary);

    await printService.createPrintJob(orderId, 'user-1', orgId);

    expect(createSpy).toHaveBeenCalledOnce();
    const callArg = createSpy.mock.calls[0]?.[0];
    expect(callArg?.receiptData).toMatchObject({
      branchName: 'Wendo Kingz',
      orderNumber: 'WCB-0042',
      dailyNumber: 42,
      orderType: 'DINE_IN',
      paymentMethod: 'CASH',
    });
  });

  it('returns existing active job when unique active key conflict occurs', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue({
      id: orderId,
      siteId: orgId,
      dailyNumber: 42,
      orderDate: new Date('2026-03-08'),
      type: 'DINE_IN',
      tableNumber: 'T5',
      subtotal: { toString: () => '1200' } as never,
      deliveryFee: { toString: () => '0' } as never,
      total: { toString: () => '1200' } as never,
      paymentMethod: 'CASH',
      paidAt: new Date('2026-03-08T14:32:00Z'),
      createdAt: new Date('2026-03-08T10:00:00Z'),
      site: { name: 'Wendo Kingz' },
      createdBy: { name: 'Jane M.' },
      items: [],
    });

    vi.spyOn(printRepository, 'findActiveJobForOrder')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(samplePrintJobSummary);

    const uniqueError = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['print_jobs_active_key_key'] },
    });
    vi.spyOn(printRepository, 'createPrintJob').mockRejectedValue(uniqueError);

    const result = await printService.createPrintJob(orderId, 'user-1', orgId);

    expect(result).toBe(samplePrintJobSummary);
  });

  // ─── Targeted print-job routing ──────────────────────────────────────────

  it('passes a valid same-branch targetStationId through to the repository', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(paidOrderFixture as never);
    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(null);
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue(sampleStation);
    const createSpy = vi
      .spyOn(printRepository, 'createPrintJob')
      .mockResolvedValue({ ...samplePrintJobSummary, targetStationId: stationId });

    await printService.createPrintJob(orderId, 'user-1', orgId, 'RECEIPT', stationId);

    expect(createSpy.mock.calls[0]?.[0]?.targetStationId).toBe(stationId);
  });

  it('rejects a targetStationId that belongs to another branch', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(paidOrderFixture as never);
    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(null);
    // findPrintStationById is org-scoped → another branch's station resolves to null.
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue(null);

    await expect(
      printService.createPrintJob(orderId, 'user-1', orgId, 'RECEIPT', stationId),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a targetStationId for an inactive station', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(paidOrderFixture as never);
    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(null);
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue({
      ...sampleStation,
      isActive: false,
    });

    await expect(
      printService.createPrintJob(orderId, 'user-1', orgId, 'RECEIPT', stationId),
    ).rejects.toThrow(ValidationError);
  });

  it('creates a null-target job when no targetStationId is given (backward compatible)', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(paidOrderFixture as never);
    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(null);
    const stationLookup = vi.spyOn(printRepository, 'findPrintStationById');
    const createSpy = vi
      .spyOn(printRepository, 'createPrintJob')
      .mockResolvedValue(samplePrintJobSummary);

    await printService.createPrintJob(orderId, 'user-1', orgId, 'RECEIPT');

    expect(createSpy.mock.calls[0]?.[0]?.targetStationId).toBeNull();
    // No station validation lookup should happen for an untargeted job.
    expect(stationLookup).not.toHaveBeenCalled();
  });

  it('returns the existing active job without re-creating it (idempotent)', async () => {
    vi.spyOn(printRepository, 'findOrderForReceipt').mockResolvedValue(paidOrderFixture as never);
    vi.spyOn(printRepository, 'findActiveJobForOrder').mockResolvedValue(samplePrintJobSummary);
    // Validation runs before the idempotency check, so the station lookup still happens.
    const stationLookup = vi
      .spyOn(printRepository, 'findPrintStationById')
      .mockResolvedValue(sampleStation);
    const createSpy = vi.spyOn(printRepository, 'createPrintJob');

    const result = await printService.createPrintJob(orderId, 'user-1', orgId, 'RECEIPT', stationId);

    // The existing job is returned; the new target is intentionally ignored.
    expect(result).toBe(samplePrintJobSummary);
    expect(createSpy).not.toHaveBeenCalled();
    expect(stationLookup).toHaveBeenCalledWith(stationId, orgId);
  });
});

describe('printService.createTestPrintJob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueues a BILL job pinned to the station', async () => {
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue(sampleStation);
    const createSpy = vi
      .spyOn(printRepository, 'createPrintJob')
      .mockResolvedValue({ ...samplePrintJobSummary, receiptType: 'BILL', targetStationId: stationId });

    await printService.createTestPrintJob(stationId, orgId, 'user-1');

    const arg = createSpy.mock.calls[0]?.[0];
    expect(arg?.targetStationId).toBe(stationId);
    expect(arg?.receiptType).toBe('BILL');
    expect(arg?.orderId).toBeUndefined();
  });

  it('throws NotFoundError for an unknown station', async () => {
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue(null);

    await expect(
      printService.createTestPrintJob(stationId, orgId, 'user-1'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GET /api/v1/print-stations/selectable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a trimmed station list for a waiter', async () => {
    vi.spyOn(printService, 'listPrintStations').mockResolvedValue([
      { ...sampleStation, isOnline: true },
    ]);

    const res = await request(app)
      .get('/api/v1/print-stations/selectable')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: stationId, name: 'Counter Printer', isOnline: true }]);
  });

  it('returns 403 for a chef role', async () => {
    const res = await request(app)
      .get('/api/v1/print-stations/selectable')
      .set('Authorization', `Bearer ${chefToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/print-stations/:id/test-print', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a test print for a manager', async () => {
    vi.spyOn(printService, 'createTestPrintJob').mockResolvedValue({
      ...samplePrintJobSummary,
      receiptType: 'BILL',
      targetStationId: stationId,
    });

    const res = await request(app)
      .post(`/api/v1/print-stations/${stationId}/test-print`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Test print sent to station');
  });

  it('returns 403 for a waiter role', async () => {
    const res = await request(app)
      .post(`/api/v1/print-stations/${stationId}/test-print`)
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
  });
});

describe('printService.createPrintStation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a pst_ prefixed token and stores a hash', async () => {
    const createSpy = vi.spyOn(printRepository, 'createPrintStation').mockResolvedValue(sampleStation);

    const result = await printService.createPrintStation('Counter Printer', orgId);

    expect(result.token).toMatch(/^pst_[0-9a-f]{64}$/);
    // The stored token (hash) must differ from the raw token
    const storedHash = createSpy.mock.calls[0]?.[0]?.tokenHash ?? '';
    expect(storedHash).not.toBe(result.token);
    expect(storedHash).toHaveLength(64); // SHA-256 hex
  });
});

describe('printService.listPrintStations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks station as online when lastSeenAt is recent', async () => {
    vi.spyOn(printRepository, 'listPrintStations').mockResolvedValue([
      { ...sampleStation, lastSeenAt: new Date(Date.now() - 30_000) }, // 30s ago
    ]);

    const result = await printService.listPrintStations(orgId);
    expect(result[0]?.isOnline).toBe(true);
  });

  it('marks station as offline when lastSeenAt is old', async () => {
    vi.spyOn(printRepository, 'listPrintStations').mockResolvedValue([
      { ...sampleStation, lastSeenAt: new Date(Date.now() - 120_000) }, // 2 min ago
    ]);

    const result = await printService.listPrintStations(orgId);
    expect(result[0]?.isOnline).toBe(false);
  });

  it('marks station as offline when lastSeenAt is null', async () => {
    vi.spyOn(printRepository, 'listPrintStations').mockResolvedValue([
      { ...sampleStation, lastSeenAt: null },
    ]);

    const result = await printService.listPrintStations(orgId);
    expect(result[0]?.isOnline).toBe(false);
  });
});

describe('printService.deactivatePrintStation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundError when station does not exist', async () => {
    vi.spyOn(printRepository, 'findPrintStationById').mockResolvedValue(null);

    await expect(
      printService.deactivatePrintStation(stationId, orgId),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('printService.updateJobStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clears active key and records printedByStationId on completion', async () => {
    vi.spyOn(printRepository, 'findPrintJobById').mockResolvedValue(samplePrintJob);
    const updateSpy = vi.spyOn(printRepository, 'updatePrintJobStatus').mockResolvedValue(samplePrintJob);

    await printService.updateJobStatus(
      printJobId,
      orgId,
      { status: 'COMPLETED' },
      stationId,
    );

    const updateData = updateSpy.mock.calls[0]?.[2];
    expect(updateData?.status).toBe('COMPLETED');
    expect(updateData?.printedByStationId).toBe(stationId);
    expect(updateData?.activeKey).toBeNull();
    expect(updateData?.claimedByStationId).toBeNull();
    expect(updateData?.claimedAt).toBeNull();
    expect(updateData?.leaseExpiresAt).toBeNull();
    expect(updateData?.printedAt).toBeInstanceOf(Date);
  });
});

describe('printService.claimJobsForStation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('expires old pending jobs and returns current ones', async () => {
    const expireSpy = vi.spyOn(printRepository, 'expireOldPendingJobs').mockResolvedValue(2);
    const claimSpy = vi.spyOn(printRepository, 'claimPendingJobsForStation').mockResolvedValue([samplePrintJob]);

    const result = await printService.claimJobsForStation(orgId, stationId, 10);

    expect(expireSpy).toHaveBeenCalledOnce();
    expect(claimSpy).toHaveBeenCalledWith(orgId, stationId, 10, 120, expect.any(Date));
    expect(result).toHaveLength(1);
  });
});
