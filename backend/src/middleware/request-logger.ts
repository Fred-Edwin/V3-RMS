import type { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

const httpLogger = pinoHttp({ logger });

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  httpLogger(req, res);
  next();
};
