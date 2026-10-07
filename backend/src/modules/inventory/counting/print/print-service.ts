import type { Request } from 'express';
import { NotFoundError } from '../../../../utils/errors';
import { requireHubReader } from '../../_shared/central-store-access';
import { adoptNewItems } from '../_shared/count-sections';
import { countNotOpenError } from '../_shared/count-errors';
import { buildBlankSheet, buildRecordPrint } from '../_shared/count-view';
import { printRepository } from './print-repository';
import type { BlankSheet, CountRecordPrint } from './print.types';

type Actor = NonNullable<Request['user']>;

export const printService = {
  /**
   * C6: the printed record of a signed count (Paper step 44): the differences and what was decided, both signatures. It carries
   * expected stock, so it is for the readers (`counts.read`, checked on the route). A count still being counted has no record yet.
   */
  record: async (actor: Actor, id: string, now: Date = new Date()): Promise<CountRecordPrint> => {
    const siteId = await requireHubReader(actor);
    const count = await printRepository.findById(siteId, id);
    if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
    if (count.status === 'OPEN') throw countNotOpenError();
    return buildRecordPrint(count, now);
  },

  /** C7: the blank sheet (Paper step 43): every section in shelf order with item and unit, empty boxes, no stock figure of any kind. */
  blankSheet: async (actor: Actor, now: Date = new Date()): Promise<BlankSheet> => {
    const siteId = await requireHubReader(actor);
    await adoptNewItems(siteId);
    const [sections, items] = await Promise.all([printRepository.listSections(siteId), printRepository.listItems(siteId)]);
    return buildBlankSheet({
      now,
      sections: sections
        .filter((s) => s.itemCount > 0)
        .map((s) => ({ id: s.id, name: s.name, supplierName: s.supplierName, items: items.filter((i) => i.sectionId === s.id).map((i) => ({ name: i.name, unit: i.unit })) })),
    });
  },
};
