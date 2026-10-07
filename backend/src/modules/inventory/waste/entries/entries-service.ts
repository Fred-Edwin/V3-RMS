import type { Request } from 'express';
import { blindnessOf } from '../../_shared/blind-rule';
import { requireHubReader } from '../../_shared/central-store-access';
import { addDays, clockText, dayStartInstant, nairobiDay } from '../../stock/_shared/nairobi-time';
import type { WasteList } from '../_shared/waste-contract';
import { seesOwnEntriesOnly } from '../_shared/waste-rules';
import { wasteView } from '../_shared/waste-view';
import { entriesRepository, type EntryScope, type EntryWindow } from './entries-repository';
import { buildWasteKpis } from './entries-kpis';
import type { WasteListQuery } from './entries.types';

type Actor = NonNullable<Request['user']>;

/** "2 items logged at 14:20. You can reverse your own entries today." */
export const bannerFor = (batch: { at: Date; count: number }): string =>
  `${batch.count} ${batch.count === 1 ? 'item' : 'items'} logged at ${clockText(batch.at)}. You can reverse your own entries today.`;

export const entriesService = {
  /**
   * W3: the waste list. A caller without `stock.read` (the Attendant) gets their own entries only, whatever `scope` says;
   * everyone else may narrow to their own with `scope=mine`. The KPI strip is for those who may see the whole store's
   * money; the banner is the own-entries-only reader's reminder of what they just logged.
   */
  list: async (actor: Actor, query: WasteListQuery, now: Date = new Date()): Promise<WasteList> => {
    const siteId = await requireHubReader(actor);
    const ownOnly = seesOwnEntriesOnly(actor);
    const scope: EntryScope = {
      siteId,
      ...(ownOnly || query.scope === 'mine' ? { loggedById: actor.id } : {}),
      ...(query.search ? { search: query.search } : {}),
    };
    // KPIs follow the scope but not the search; chips follow both, so a chip's number matches its rows.
    const kpiScope: EntryScope = { siteId, ...(scope.loggedById ? { loggedById: scope.loggedById } : {}) };

    const today = nairobiDay(now);
    const window: EntryWindow = { todayStart: dayStartInstant(today), last7Start: dayStartInstant(addDays(today, -6)) };

    const [{ rows, total }, chips] = await Promise.all([
      entriesRepository.findPage(scope, query.period, window, query.page, query.pageSize),
      entriesRepository.chipCounts(scope, window),
    ]);

    let kpis: WasteList['kpis'];
    if (!ownOnly && !blindnessOf(actor).itemCosts) {
      const [last7, reversedLast7] = await Promise.all([entriesRepository.findLast7(kpiScope, window), entriesRepository.findReversedLast7(kpiScope, window)]);
      kpis = buildWasteKpis({ last7, reversedLast7, todayStart: window.todayStart });
    }

    let bannerText: string | null | undefined;
    if (ownOnly) {
      const batch = await entriesRepository.latestBatchToday(siteId, actor.id, window.todayStart);
      bannerText = batch ? bannerFor(batch) : null;
    }

    return wasteView.list(actor, { logs: rows, chips, page: { page: query.page, pageSize: query.pageSize, total }, kpis, bannerText }, now);
  },
};
