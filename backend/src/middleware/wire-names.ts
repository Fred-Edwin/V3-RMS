import type { RequestHandler } from 'express';
import { fromWire, toWire } from '../shared/utils/wire-names';

/**
 * Keeps the API's wire names ("organizationId", "organization", ...) unchanged while the code
 * says "site". Incoming body and query are translated to code names before validation;
 * every `res.json` body is translated back on the way out. See shared/utils/wire-names.ts.
 */
export const wireNames: RequestHandler = (req, res, next) => {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    req.body = fromWire(req.body);
  }

  // Express 5 exposes `query` as a getter on the prototype; shadow it with the translated copy.
  Object.defineProperty(req, 'query', {
    value: fromWire({ ...req.query }),
    configurable: true,
    enumerable: true,
    writable: true,
  });

  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(toWire(body));

  next();
};
