import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { app } from '../src/app';
import { healthService } from '../src/services/health-service';

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok when database and redis are up', async () => {
    vi.spyOn(healthService, 'getHealth').mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        redis: 'up',
      },
    });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.services.database).toBe('up');
    expect(response.body.services.redis).toBe('up');
  });

  it('returns degraded when database is down', async () => {
    vi.spyOn(healthService, 'getHealth').mockResolvedValue({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        redis: 'up',
      },
    });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.services.database).toBe('down');
    expect(response.body.services.redis).toBe('up');
  });

  it('returns degraded when redis is down', async () => {
    vi.spyOn(healthService, 'getHealth').mockResolvedValue({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        redis: 'down',
      },
    });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.services.database).toBe('up');
    expect(response.body.services.redis).toBe('down');
  });
});
