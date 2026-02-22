import { prisma } from '../config/database';
import { redisClient } from '../config/redis';

export interface HealthDependencyStatus {
  database: 'up' | 'down';
  redis: 'up' | 'down';
}

export const healthRepository = {
  async checkDatabase(): Promise<'up' | 'down'> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  },

  async checkRedis(): Promise<'up' | 'down'> {
    try {
      const response = await redisClient.ping();
      return response === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  },
};
