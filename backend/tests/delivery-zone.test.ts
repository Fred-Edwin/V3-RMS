import request from 'supertest';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { deliveryZoneService } from '../src/services/delivery-zone-service';
import { ConflictError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const managerToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'MANAGER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const waiterToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const zoneId = '44444444-4444-4444-8444-444444444444';

describe('Delivery zone routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/delivery-zones lets manager create a zone', async () => {
    vi.spyOn(deliveryZoneService, 'createZone').mockResolvedValue({
      id: zoneId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Kiganjo',
      fee: new Prisma.Decimal('200.00'),
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    const response = await request(app)
      .post('/api/v1/delivery-zones')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Kiganjo',
        fee: '200.00',
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Delivery zone created successfully');
  });

  it('POST /api/v1/delivery-zones blocks waiter role', async () => {
    const response = await request(app)
      .post('/api/v1/delivery-zones')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        name: 'Kiganjo',
        fee: '200.00',
      });

    expect(response.status).toBe(403);
  });

  it('GET /api/v1/delivery-zones returns active zones for branch', async () => {
    vi.spyOn(deliveryZoneService, 'listZones').mockResolvedValue([
      {
        id: zoneId,
        organizationId: '22222222-2222-4222-8222-222222222222',
        name: 'Kiganjo',
        fee: new Prisma.Decimal('200.00'),
        isActive: true,
        createdAt: new Date('2026-02-24T10:00:00.000Z'),
        updatedAt: new Date('2026-02-24T10:00:00.000Z'),
      },
    ]);

    const response = await request(app)
      .get('/api/v1/delivery-zones')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].isActive).toBe(true);
  });

  it('PATCH /api/v1/delivery-zones/:id updates zone', async () => {
    vi.spyOn(deliveryZoneService, 'updateZone').mockResolvedValue({
      id: zoneId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Kiganjo Town',
      fee: new Prisma.Decimal('250.00'),
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T11:00:00.000Z'),
    });

    const response = await request(app)
      .patch(`/api/v1/delivery-zones/${zoneId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Kiganjo Town',
        fee: '250.00',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Kiganjo Town');
  });

  it('DELETE /api/v1/delivery-zones/:id deactivates zone with no orders', async () => {
    vi.spyOn(deliveryZoneService, 'deleteZone').mockResolvedValue();

    const response = await request(app)
      .delete(`/api/v1/delivery-zones/${zoneId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Delivery zone deactivated');
  });

  it('DELETE /api/v1/delivery-zones/:id returns 409 when zone has orders', async () => {
    vi.spyOn(deliveryZoneService, 'deleteZone').mockRejectedValue(
      new ConflictError('Delivery zone cannot be deactivated because it has associated orders'),
    );

    const response = await request(app)
      .delete(`/api/v1/delivery-zones/${zoneId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(409);
  });
});
