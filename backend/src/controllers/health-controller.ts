import type { Request, Response } from 'express';
import { healthService } from '../services/health-service';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const health = await healthService.getHealth();
  res.status(200).json(health);
};
