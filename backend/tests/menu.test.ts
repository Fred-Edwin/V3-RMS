import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { menuService } from '../src/services/menu-service';
import { ConflictError, ForbiddenError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const categoryId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const anotherBranchId = '44444444-4444-4444-8444-444444444444';

describe('Menu routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/menu/categories allows SYSTEM_ADMIN', async () => {
    vi.spyOn(menuService, 'createCategory').mockResolvedValue();
    const token = signAccessToken({
      userId: 'sa-1',
      role: 'SYSTEM_ADMIN',
      organizationId: null,
    });

    const response = await request(app)
      .post('/api/v1/menu/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hot Drinks',
        prepStation: 'BARISTA',
        displayOrder: 1,
      });

    expect(response.status).toBe(201);
  });

  it('POST /api/v1/menu/categories blocks WAITER with 403', async () => {
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: branchId,
    });

    const response = await request(app)
      .post('/api/v1/menu/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hot Drinks',
        prepStation: 'BARISTA',
        displayOrder: 1,
      });

    expect(response.status).toBe(403);
  });

  it('DELETE /api/v1/menu/categories/:id returns 409 when category has active items', async () => {
    vi.spyOn(menuService, 'deleteCategory').mockRejectedValue(
      new ConflictError('Cannot delete a category that has active menu items. Deactivate or reassign items first.'),
    );
    const token = signAccessToken({
      userId: 'sa-1',
      role: 'SYSTEM_ADMIN',
      organizationId: null,
    });

    const response = await request(app)
      .delete(`/api/v1/menu/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it('PATCH /api/v1/menu/items/:id/availability lets manager toggle own branch item', async () => {
    vi.spyOn(menuService, 'setItemAvailability').mockResolvedValue({
      id: 'availability-1',
      organizationId: branchId,
      menuItemId: itemId,
      isAvailable: false,
      updatedAt: new Date('2026-02-23T12:00:00.000Z'),
      updatedBy: 'manager-1',
    });
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: branchId,
    });

    const response = await request(app)
      .patch(`/api/v1/menu/items/${itemId}/availability`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false });

    expect(response.status).toBe(200);
    expect(response.body.data.menuItemId).toBe(itemId);
    expect(response.body.data.organizationId).toBe(branchId);
  });

  it('PATCH /api/v1/menu/items/:id/availability blocks manager targeting another branch', async () => {
    vi.spyOn(menuService, 'setItemAvailability').mockRejectedValue(
      new ForbiddenError('Managers can only update availability for their own branch'),
    );
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: branchId,
    });

    const response = await request(app)
      .patch(`/api/v1/menu/items/${itemId}/availability?branchId=${anotherBranchId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false });

    expect(response.status).toBe(403);
  });

  it('GET /api/v1/menu returns available-only payload for waiter', async () => {
    vi.spyOn(menuService, 'getMenu').mockResolvedValue({
      categories: [
        {
          id: categoryId,
          name: 'Hot Drinks',
          prepStation: 'BARISTA',
          displayOrder: 1,
          items: [
            {
              id: itemId,
              name: 'Cappuccino',
              description: 'Rich espresso with steamed milk foam',
              price: '350.00',
              isAvailable: true,
            },
          ],
        },
      ],
    });
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: branchId,
    });

    const response = await request(app).get('/api/v1/menu').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.categories[0].items).toHaveLength(1);
    expect(response.body.data.categories[0].items[0].isAvailable).toBe(true);
  });

  it('GET /api/v1/menu includes unavailable items for manager payload', async () => {
    vi.spyOn(menuService, 'getMenu').mockResolvedValue({
      categories: [
        {
          id: categoryId,
          name: 'Hot Drinks',
          prepStation: 'BARISTA',
          displayOrder: 1,
          items: [
            {
              id: itemId,
              name: 'Cappuccino',
              description: 'Rich espresso with steamed milk foam',
              price: '350.00',
              isAvailable: false,
            },
          ],
        },
      ],
    });
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: branchId,
    });

    const response = await request(app).get('/api/v1/menu').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.categories[0].items[0].isAvailable).toBe(false);
  });
});
