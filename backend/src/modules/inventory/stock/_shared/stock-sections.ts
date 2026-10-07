import { sectionNamesByItem } from '../../counting/_shared/count-reads';
import { stockRepository } from './stock-repository';

/**
 * "4 sections" under Items tracked: the number of count sections that hold at least one live item of the hub. Counting is
 * read only through `count-reads.sectionNamesByItem`; the names of the sections the live items sit in are counted once each.
 */
export const trackedSectionCount = async (siteId: string): Promise<number> => {
  const itemIds = await stockRepository.liveItemIds(siteId);
  if (itemIds.length === 0) return 0;
  return new Set((await sectionNamesByItem(siteId, itemIds)).values()).size;
};
