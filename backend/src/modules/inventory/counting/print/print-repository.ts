import { prisma } from '../../../../config/database';
import { countRecordRepository } from '../_shared/count-record-repository';
import { countSectionsRepository, type SectionRow } from '../_shared/count-sections-repository';

export type { SectionRow };

/** Printing: a signed count's record, and the blank sheet (sections and items, no stock figures). */
export const printRepository = {
  findById: countRecordRepository.findById,

  listSections: (siteId: string): Promise<SectionRow[]> => countSectionsRepository.listSections(siteId, prisma),

  /** Live items by section, in shelf order. */
  listItems: (siteId: string) => countSectionsRepository.listItems(siteId, null, prisma),
};
