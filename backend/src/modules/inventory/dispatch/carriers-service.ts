import type { Request } from 'express';
import { Prisma, type Carrier as CarrierRow } from '@prisma/client';
import { NotFoundError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { actorCan } from '../_shared/central-store-access';
import { nairobiDay } from '../counting/_shared/count-time';
import type { AddCarrierInput, Carrier, ListCarriers, ListCarriersQuery, UpdateCarrierInput } from './_shared/dispatch-contract';
import { carriersRepository as repo } from './carriers-repository';
import { loadCaller } from './dispatch-caller';
import { dispatchError } from './dispatch-errors';

type Actor = NonNullable<Request['user']>;

/** The 1st of the Nairobi month at 00:00 Nairobi (UTC+3, no daylight saving). */
const monthStartOf = (now: Date): Date => new Date(`${nairobiDay(now).slice(0, 8)}01T00:00:00+03:00`);

const wire = (row: CarrierRow, deliveriesThisMonth: number): Carrier => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  active: row.active,
  retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
  deliveriesThisMonth,
});

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const takenError = () => dispatchError('CARRIER_NAME_TAKEN', 'A carrier with this name already exists.');

export const carriersService = {
  /** P10 GET: `carriers.read` (the route's gate). `can.manage` says whether the caller may add, rename, retire and restore. */
  list: async (actor: Actor, query: ListCarriersQuery, now: Date = new Date()): Promise<ListCarriers> => {
    const c = await loadCaller(actor);
    const [rows, counts] = await Promise.all([repo.list(c.hubId, query.status), repo.countSignedSince(c.hubId, monthStartOf(now))]);
    return { carriers: rows.map((r) => wire(r, counts.get(r.id) ?? 0)), can: { manage: actorCan(actor, 'carriers.manage') } };
  },

  /** P10 POST: `carriers.manage`. */
  add: async (actor: Actor, input: AddCarrierInput): Promise<Carrier> => {
    const c = await loadCaller(actor);
    if (await repo.findByName(c.hubId, input.name)) throw takenError();
    try {
      const row = await repo.create(c.hubId, input);
      logger.info({ carrierId: row.id, actorId: actor.id, kind: row.kind }, 'Carrier added');
      return wire(row, 0);
    } catch (error) {
      if (isUniqueViolation(error)) throw takenError();
      throw error;
    }
  },

  /** P10 PATCH: `carriers.manage`. One change at a time: rename, retire or restore. Retiring keeps history. */
  update: async (actor: Actor, id: string, input: UpdateCarrierInput, now: Date = new Date()): Promise<Carrier> => {
    const c = await loadCaller(actor);
    const existing = await repo.find(c.hubId, id);
    if (!existing) throw new NotFoundError('Carrier not found');
    if (input.name !== undefined) {
      if (input.name !== existing.name) {
        if (await repo.findByName(c.hubId, input.name, id)) throw takenError();
        try {
          await repo.rename(c.hubId, id, input.name);
        } catch (error) {
          if (isUniqueViolation(error)) throw takenError();
          throw error;
        }
      }
    } else if (input.active !== undefined && input.active !== existing.active) {
      await repo.setActive(c.hubId, id, input.active, now);
    }
    const updated = await repo.find(c.hubId, id);
    if (!updated) throw new NotFoundError('Carrier not found');
    logger.info({ carrierId: id, actorId: actor.id, change: input.name !== undefined ? 'rename' : input.active ? 'restore' : 'retire' }, 'Carrier changed');
    const counts = await repo.countSignedSince(c.hubId, monthStartOf(now));
    return wire(updated, counts.get(id) ?? 0);
  },
};
