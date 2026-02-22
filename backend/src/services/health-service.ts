import { healthRepository, type HealthDependencyStatus } from '../repositories/health-repository';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: HealthDependencyStatus;
}

export const healthService = {
  async getHealth(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      healthRepository.checkDatabase(),
      healthRepository.checkRedis(),
    ]);

    const services: HealthDependencyStatus = { database, redis };
    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
    };
  },
};
