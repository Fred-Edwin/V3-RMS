import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { branchService } from '../src/services/branch-service';
import { signAccessToken } from '../src/utils/jwt';

describe('Branch routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/branches allows SYSTEM_ADMIN', async () => {
    vi.spyOn(branchService, 'createBranch').mockResolvedValue({
      id: 'branch-1',
      name: 'Wendo Town',
      address: 'Town',
      city: 'Nyeri',
      latitude: '0' as unknown as number,
      longitude: '0' as unknown as number,
      isHub: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signAccessToken({
      userId: 'sa-1',
      role: 'SYSTEM_ADMIN',
      organizationId: null,
    });

    const response = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wendo Town',
        address: 'Town',
        city: 'Nyeri',
        latitude: -0.42,
        longitude: 36.95,
      });

    expect(response.status).toBe(201);
  });

  it('POST /api/v1/branches blocks WAITER with 403', async () => {
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wendo Town',
        address: 'Town',
        city: 'Nyeri',
        latitude: -0.42,
        longitude: 36.95,
      });

    expect(response.status).toBe(403);
  });

  it('PATCH /api/v1/branches/:id/set-hub sets hub branch', async () => {
    vi.spyOn(branchService, 'setHubBranch').mockResolvedValue({
      id: 'branch-1',
      name: 'Wendo Kingz',
      address: 'Kingz',
      city: 'Nyeri',
      latitude: '0' as unknown as number,
      longitude: '0' as unknown as number,
      isHub: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signAccessToken({
      userId: 'director-1',
      role: 'DIRECTOR',
      organizationId: null,
    });

    const response = await request(app)
      .patch('/api/v1/branches/11111111-1111-4111-8111-111111111111/set-hub')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.isHub).toBe(true);
  });

  it('GET /api/v1/branches returns list for director', async () => {
    vi.spyOn(branchService, 'listBranches').mockResolvedValue([
      {
        id: 'branch-1',
        name: 'Wendo Kingz',
        address: 'Kingz',
        city: 'Nyeri',
        latitude: '0' as unknown as number,
        longitude: '0' as unknown as number,
        isHub: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const token = signAccessToken({
      userId: 'director-1',
      role: 'DIRECTOR',
      organizationId: null,
    });

    const response = await request(app).get('/api/v1/branches').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it('PATCH /api/v1/branches/:id/profile allows director without branch context', async () => {
    const branchId = '11111111-1111-4111-8111-111111111111';
    const updateSpy = vi.spyOn(branchService, 'updateBranchProfile').mockResolvedValue({
      id: branchId,
      name: 'Wendo Nanyuki',
      address: 'Nanyuki',
      city: 'Nanyuki',
      latitude: '0' as unknown as number,
      longitude: '0' as unknown as number,
      isHub: false,
      isActive: true,
      phone: '0707242987',
      mpesaPaybill: '522522',
      accountNumber: 'Nanyuki',
      googleReviewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = signAccessToken({
      userId: 'director-1',
      role: 'DIRECTOR',
      organizationId: null,
    });

    const response = await request(app)
      .patch(`/api/v1/branches/${branchId}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        phone: '0707242987',
        mpesaPaybill: '522522',
        accountNumber: 'Nanyuki',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBe('0707242987');
    expect(updateSpy).toHaveBeenCalledWith(
      branchId,
      expect.objectContaining({ role: 'DIRECTOR', organizationId: null }),
      {
        phone: '0707242987',
        mpesaPaybill: '522522',
        accountNumber: 'Nanyuki',
      },
    );
  });
});
