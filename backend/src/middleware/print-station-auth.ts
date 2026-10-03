import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { printRepository } from '../repositories/print-repository';
import { UnauthorizedError } from '../utils/errors';

export const authenticatePrintStation = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer pst_')) {
    throw new UnauthorizedError('Missing or invalid print station token');
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const station = await printRepository.findPrintStationByTokenHash(tokenHash);

  if (!station || !station.isActive) {
    throw new UnauthorizedError('Invalid or inactive print station token');
  }

  req.printStation = {
    id: station.id,
    siteId: station.siteId,
  };

  next();
};
