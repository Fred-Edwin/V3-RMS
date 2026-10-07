import { countSectionsRepository } from './count-sections-repository';

/**
 * A new catalog item whose preferred supplier already has a supplier section is placed at the end of that section, the next time
 * Count setup (C15), Start a count (C8) or a count start (C9) runs (contract §2.7). Idempotent, one statement, and it edits nothing
 * in the catalog. An item with no supplier (or a supplier with no section) is left alone: it shows as "Not in any section" until
 * the Manager places it.
 */
export const adoptNewItems = (siteId: string): Promise<number> => countSectionsRepository.adoptNewItems(siteId);
