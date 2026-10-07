import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { actorCan, requireHubActor } from '../../_shared/central-store-access';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { countError, countNotOpenError, notYourCountError } from '../_shared/count-errors';
import { isSignKey, signedWith, startedWith } from '../_shared/count-idempotency';
import { readCountDetail, readLiveFigures } from '../_shared/count-detail-reader';
import { firstNameOf } from '../_shared/count-people';
import { nextCountReference } from '../_shared/count-numbers';
import { countNotify } from '../_shared/count-notify';
import { countPin } from '../_shared/count-pin';
import { countSettingsRepository } from '../_shared/count-settings-repository';
import { settingsInForce } from '../_shared/count-settings';
import { adoptNewItems } from '../_shared/count-sections';
import { capsOf } from '../_shared/count-state';
import { lastCountedText, nairobiDay } from '../_shared/count-time';
import { buildCheckResult, buildSaveLinesResult, buildSignPreview, judgeRecordLine, progressView, sectionsText } from '../_shared/count-view';
import type { CountRecord } from '../_shared/count-record-repository';
import { applySave, orderedSections, planFreeze, type FreezeMode, type SelfSignCause } from './record-logic';
import { recordRepository, type ScopeItem } from './record-repository';
import type { CheckInput, CheckResult, CountOutcome, SaveLinesInput, SaveLinesResult, SectionOrderInput, SectionOrderResult, SignInput, SignPreview, StartCountInput, StartOptions, StartOptionsQuery } from './record.types';

type Actor = NonNullable<Request['user']>;

/** How many earlier counts of an item the repeat-shortfall streak looks back over. */
const STREAK_LOOKBACK = 10;

// --- shared checks -------------------------------------------------------------

/**
 * The caller's own count. Someone else's count is 403 NOT_YOUR_COUNT for a caller who may read counts (they know it exists), and
 * 404 for one who may not (an Attendant is told nothing about another person's count).
 */
const loadOwnCount = async (actor: Actor, siteId: string, countId: string): Promise<CountRecord> => {
  const count = await recordRepository.findById(siteId, countId);
  if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
  if (count.counterId !== actor.id) {
    if (actorCan(actor, 'counts.read')) throw notYourCountError();
    throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
  }
  return count;
};

const loadOwnOpenCount = async (actor: Actor, siteId: string, countId: string): Promise<CountRecord> => {
  const count = await loadOwnCount(actor, siteId, countId);
  if (count.status !== 'OPEN') throw countNotOpenError();
  return count;
};

/** A recount starts from a line that is outside the range on a count that has been signed. */
const loadRecountLine = async (siteId: string, lineId: string) => {
  const line = await recordRepository.findLine(siteId, lineId);
  if (!line) throw new NotFoundError('Count line not found', 'COUNT_LINE_NOT_FOUND');
  if (line.count.status === 'OPEN' || line.result !== 'EXCEEDS') {
    throw countError('RECOUNT_NOT_ALLOWED', 'Only an item that was outside the range on a signed count can be counted again.');
  }
  return line;
};

const requireCentralStore = async (siteId: string) => {
  const location = await recordRepository.findCentralStore(siteId);
  if (!location) throw new NotFoundError('No Central Store is configured');
  return location;
};

// --- starting ------------------------------------------------------------------

type Scope = {
  /** The sections that were picked, in the order they are counted. */
  sections: { id: string; name: string }[];
  /** Every item to count, in shelf order: the explicitly picked items first, then each section's items. */
  items: ScopeItem[];
};

const resolveScope = async (actor: Actor, siteId: string, input: StartCountInput, recountItemId: string | null, now: Date): Promise<Scope> => {
  const sectionIds = [...new Set(input.sectionIds ?? [])];
  const sections: Scope['sections'] = [];
  const items: ScopeItem[] = [];
  const taken = new Set<string>();

  const explicit = [...new Set([...(recountItemId ? [recountItemId] : []), ...(input.itemIds ?? [])])];
  if (explicit.length > 0) {
    const found = new Map((await recordRepository.scopeItemsById(siteId, explicit)).map((i) => [i.id, i]));
    for (const id of explicit) {
      const item = found.get(id);
      if (!item) throw countError('ITEM_NOT_IN_SETUP', 'An item you picked is not in the catalog any more.');
      items.push(item);
      taken.add(id);
    }
  }

  if (sectionIds.length > 0) {
    const [shelf, dayOrder] = await Promise.all([recordRepository.listSections(siteId), recordRepository.findDayOrder(siteId, actor.id, nairobiDay(now))]);
    const known = new Set(shelf.map((s) => s.id));
    if (!sectionIds.every((id) => known.has(id))) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');
    // Counted in this person's own order for today when they set one, else the Manager's shelf order.
    const picked = orderedSections(shelf, dayOrder).filter((s) => sectionIds.includes(s.id));
    const placed = await recordRepository.listSectionItems(siteId, sectionIds);
    for (const section of picked) {
      sections.push({ id: section.id, name: section.name });
      for (const row of placed.filter((p) => p.sectionId === section.id)) {
        if (taken.has(row.itemId)) continue;
        taken.add(row.itemId);
        items.push({ id: row.itemId, name: row.name, unit: row.unit, sectionId: section.id, sectionName: section.name });
      }
    }
  }

  if (items.length === 0) throw countError('NOTHING_TO_COUNT', 'There is nothing to count in what you picked.');
  return { sections, items };
};

const uniqueViolationOf = (error: unknown): 'OPEN_COUNT' | 'ITEM_BUSY' | 'SAME_KEY' | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
  const target = JSON.stringify(error.meta ?? {});
  if (target.includes('count_open_per_counter_key')) return 'OPEN_COUNT';
  if (target.includes('count_line_open_item_key')) return 'ITEM_BUSY';
  if (target.includes('idempotency_key')) return 'SAME_KEY';
  // Prisma names the columns of a unique index it cannot map to a model field.
  if (target.includes('counter_id')) return 'OPEN_COUNT';
  if (target.includes('inventory_item_id')) return 'ITEM_BUSY';
  return null;
};

const sectionBusyError = (busy: { counterName: string; countId: string; reference: string }, what: string) =>
  countError('SECTION_BUSY', `${firstNameOf(busy.counterName)} is counting ${what} right now.`, { countId: busy.countId, reference: busy.reference, counterName: busy.counterName });

const openCountError = (open: { id: string; reference: string }) =>
  countError('YOU_HAVE_OPEN_COUNT', `Finish or sign ${open.reference} before you start another count.`, { countId: open.id, reference: open.reference });

export const recordService = {
  /** C8: the sections to pick from, in this person's order for today, with what is busy and what has gone longest without a count. */
  startOptions: async (actor: Actor, query: StartOptionsQuery, now: Date = new Date()): Promise<StartOptions> => {
    const siteId = await requireHubActor(actor);
    await adoptNewItems(siteId);
    const today = nairobiDay(now);
    const [shelf, lastCounts, busy, dayOrder, open, unsectioned, recountLine] = await Promise.all([
      recordRepository.listSections(siteId),
      recordRepository.sectionLastCounts(siteId),
      recordRepository.busySections(siteId),
      recordRepository.findDayOrder(siteId, actor.id, today),
      recordRepository.findOpenOf(siteId, actor.id),
      recordRepository.unsectionedCount(siteId),
      query.recountLineId ? loadRecountLine(siteId, query.recountLineId) : Promise.resolve(null),
    ]);

    const lastBySection = new Map(lastCounts.map((l) => [l.sectionId, l]));
    const busyBySection = new Map(busy.map((b) => [b.sectionId, b]));
    const ordered = orderedSections(shelf, dayOrder);

    // The one section that has gone longest without a count (never counted first, then the oldest; ties by shelf position).
    const longest = shelf
      .filter((s) => s.itemCount > 0)
      .sort((a, b) => {
        const la = lastBySection.get(a.id)?.at.getTime() ?? -Infinity;
        const lb = lastBySection.get(b.id)?.at.getTime() ?? -Infinity;
        return la - lb || a.position - b.position;
      })[0];

    return {
      sections: ordered.map((s) => {
        const last = lastBySection.get(s.id);
        const held = busyBySection.get(s.id);
        return {
          id: s.id,
          name: s.name,
          supplierName: s.supplierName,
          itemCount: s.itemCount,
          lastCountedAt: last ? last.at.toISOString() : null,
          lastCountedText: last ? lastCountedText(last.at, now) : 'Never',
          lastCountedBy: last ? firstNameOf(last.counterName) : null,
          longestSinceCount: longest?.id === s.id,
          busy: held ? { countId: held.countId, reference: held.reference, counterName: held.counterName } : null,
        };
      }),
      order: { mode: dayOrder && dayOrder.length > 0 ? 'TODAY' : 'SHELF', appliesTo: today },
      unsectionedCount: unsectioned,
      openCount: open ? { id: open.id, reference: open.reference, sectionsText: sectionsText(open), progressText: progressView(open.lines).text } : null,
      recount: recountLine
        ? {
            lineId: recountLine.id,
            countId: recountLine.count.id,
            countReference: recountLine.count.reference,
            itemId: recountLine.inventoryItem.id,
            itemName: recountLine.inventoryItem.name,
            unit: recountLine.inventoryItem.usageUnit,
            sectionName: recountLine.sectionName,
          }
        : null,
      can: { start: open === null },
    };
  },

  /**
   * C9: start a count (contract §5.1). One transaction: lock the picked sections, refuse if the caller already has an open count or
   * any item is in someone else's open count, number it CNT-yyyy-nnnn, copy one line per item in shelf order. A repeated
   * `idempotencyKey` returns the same count (replayed). The two partial unique indexes are the backstop for a race.
   */
  start: async (actor: Actor, input: StartCountInput, now: Date = new Date()): Promise<CountOutcome> => {
    const siteId = await requireHubActor(actor);

    const replay = async (): Promise<CountOutcome | null> => {
      const existing = await recordRepository.findByStartKey(siteId, actor.id, input.idempotencyKey);
      return existing ? { detail: await readCountDetail(actor, siteId, existing, now), replayed: true } : null;
    };
    const already = await replay();
    if (already) return already;

    await adoptNewItems(siteId);
    const location = await requireCentralStore(siteId);
    const recountLine = input.recountOfLineId ? await loadRecountLine(siteId, input.recountOfLineId) : null;
    const scope = await resolveScope(actor, siteId, input, recountLine?.inventoryItem.id ?? null, now);

    try {
      const id = await prisma.$transaction(async (tx) => {
        await recordRepository.lockSections(tx, siteId, scope.sections.map((s) => s.id));

        const open = await recordRepository.findOpenOf(siteId, actor.id, tx);
        if (open) throw openCountError(open);

        const busy = await recordRepository.busyLines(siteId, scope.items.map((i) => i.id), tx);
        const held = busy[0];
        if (held) {
          const item = scope.items.find((i) => i.id === held.itemId)!;
          throw sectionBusyError(held, item.sectionName ?? item.name);
        }

        const reference = await nextCountReference(tx, siteId, now);
        const created = await recordRepository.createCount(tx, {
          siteId,
          locationId: location.id,
          reference,
          counterId: actor.id,
          startedAt: now,
          recountOfLineId: recountLine?.id ?? null,
          idempotencyKey: startedWith(input.idempotencyKey),
          scopeSections: scope.sections.map((s) => ({ sectionId: s.id, sectionName: s.name })),
          lines: scope.items.map((i) => ({ itemId: i.id, sectionId: i.sectionId, sectionName: i.sectionName })),
        });
        return created.id;
      });
      const count = (await recordRepository.findById(siteId, id))!;
      return { detail: await readCountDetail(actor, siteId, count, now), replayed: false };
    } catch (error) {
      // Two taps or two people racing past the checks above: the unique indexes decided, so answer as if we had checked.
      const kind = uniqueViolationOf(error);
      if (kind === 'SAME_KEY') {
        const won = await replay();
        if (won) return won;
      }
      if (kind === 'OPEN_COUNT') {
        const open = await recordRepository.findOpenOf(siteId, actor.id);
        if (open) throw openCountError(open);
      }
      if (kind === 'ITEM_BUSY') {
        const busy = (await recordRepository.busyLines(siteId, scope.items.map((i) => i.id)))[0];
        if (busy) {
          const item = scope.items.find((i) => i.id === busy.itemId)!;
          throw sectionBusyError(busy, item.sectionName ?? item.name);
        }
      }
      throw error;
    }
  },

  /** C10: autosave numbers. Last write wins; typing clears Skip and Skip clears the number; a recheck is answered once. */
  saveLines: async (actor: Actor, countId: string, input: SaveLinesInput, now: Date = new Date()): Promise<SaveLinesResult> => {
    const siteId = await requireHubActor(actor);
    await loadOwnOpenCount(actor, siteId, countId);

    // A line sent twice in one save: the last one wins.
    const wanted = new Map(input.lines.map((l) => [l.lineId, l]));
    const count = await prisma.$transaction(async (tx) => {
      await recordRepository.lockCount(tx, siteId, countId);
      const fresh = await recordRepository.findById(siteId, countId, tx);
      if (!fresh) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
      if (fresh.status !== 'OPEN') throw countNotOpenError();
      const byId = new Map(fresh.lines.map((l) => [l.id, l]));
      for (const lineId of wanted.keys()) if (!byId.has(lineId)) throw new ValidationError('A line does not belong to this count.');

      for (const [lineId, sent] of wanted) {
        const saved = applySave(byId.get(lineId)!, { countedQty: sent.countedQty, skipped: sent.skipped ?? false, recheck: sent.recheck });
        await recordRepository.saveLine(tx, lineId, saved);
      }
      await recordRepository.touchCount(tx, countId, now);
      return (await recordRepository.findById(siteId, countId, tx))!;
    });

    const caps = capsOf(actor);
    const live = caps.blind ? null : { lineIds: [...wanted.keys()], figures: await readLiveFigures(siteId, count) };
    return buildSaveLinesResult(actor, { savedAt: now, lines: count.lines, live });
  },

  /**
   * C11: the section-end check. For a caller blind to stock, the lines that exceed the range come back by name and typed number
   * only, each marked offered so it is never offered again; for one who sees stock figures it returns none (they see results live).
   */
  check: async (actor: Actor, countId: string, input: CheckInput): Promise<CheckResult> => {
    const siteId = await requireHubActor(actor);
    const count = await loadOwnOpenCount(actor, siteId, countId);
    const sectionName = input.sectionId ? (count.lines.find((l) => l.sectionId === input.sectionId)?.sectionName ?? null) : null;
    if (input.sectionId && sectionName === null) throw new ValidationError('That section is not part of this count.');
    if (!capsOf(actor).blind) return buildCheckResult({ sectionName, lines: [] });

    const live = await readLiveFigures(siteId, count);
    const exceeding = count.lines.filter(
      (l) => (!input.sectionId || l.sectionId === input.sectionId) && l.countedQty !== null && !l.recheckOffered && l.recheck === 'NONE' && judgeRecordLine(l, live).result === 'EXCEEDS',
    );
    await recordRepository.markRecheckOffered(siteId, exceeding.map((l) => l.id));
    return buildCheckResult({
      sectionName,
      lines: exceeding.map((l) => ({ id: l.id, itemName: l.inventoryItem.name, unit: l.inventoryItem.usageUnit, sectionName: l.sectionName, counted: l.countedQty! })),
    });
  },

  /** C12: what the sign dialog shows. A Manager's own count adds what applies and which causes are still needed. */
  signPreview: async (actor: Actor, countId: string): Promise<SignPreview> => {
    const siteId = await requireHubActor(actor);
    const count = await loadOwnOpenCount(actor, siteId, countId);
    const live = capsOf(actor).blind ? null : await readLiveFigures(siteId, count);
    return buildSignPreview(actor, { count, live, causes: new Map() });
  },

  /**
   * C13: sign with the caller's OWN PIN (contract §5.3). In one transaction, under a lock on the count: freeze expected stock (the
   * ledger on-hand at the sign), cost, result and streak on every line, and freeze the settings on the count. An Attendant's count
   * becomes SUBMITTED; a Manager's own becomes APPROVED, every non-zero line posts through the ledger door and the outside-range
   * lines are flagged to the Director. All or nothing. A wrong PIN writes nothing.
   */
  sign: async (actor: Actor, countId: string, input: SignInput, now: Date = new Date()): Promise<CountOutcome> => {
    const siteId = await requireHubActor(actor);
    const before = await loadOwnCount(actor, siteId, countId);
    const replayed = async (record: CountRecord): Promise<CountOutcome> => ({ detail: await readCountDetail(actor, siteId, record, now), replayed: true });
    if (before.status !== 'OPEN') {
      if (isSignKey(before.idempotencyKey, input.idempotencyKey)) return replayed(before);
      throw countNotOpenError();
    }

    const holder = await countPin.verifyOwn(actor, input.pin);
    const selfSign = capsOf(actor).resolve;
    const causes = new Map<string, SelfSignCause>((input.causes ?? []).map((c) => [c.lineId, { cause: c.cause, note: c.note ?? null }]));
    const mode: FreezeMode = selfSign ? { kind: 'SELF_SIGN', actorId: actor.id, causes } : { kind: 'SUBMIT' };

    const outcome = await prisma.$transaction(async (tx) => {
      await recordRepository.lockCount(tx, siteId, countId);
      const count = await recordRepository.findById(siteId, countId, tx);
      if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
      if (count.status !== 'OPEN') {
        if (isSignKey(count.idempotencyKey, input.idempotencyKey)) return { record: count, replay: true as const };
        throw countNotOpenError();
      }
      if (count.lines.every((l) => l.countedQty === null)) throw countError('NOTHING_COUNTED', 'Count at least one item before you sign.');

      const settings = settingsInForce(await countSettingsRepository.find(siteId, tx));
      const itemIds = count.lines.map((l) => l.inventoryItemId);
      const shortItemIds = count.lines.filter((l) => l.countedQty !== null).map((l) => l.inventoryItemId);
      const [onHand, recent] = await Promise.all([
        recordRepository.onHandAsOf(siteId, count.locationId, itemIds, now, tx),
        settings.flagRepeat ? recordRepository.recentDifferencesByItem(tx, siteId, shortItemIds, now, count.id, STREAK_LOOKBACK) : Promise.resolve(new Map<string, Prisma.Decimal[]>()),
      ]);

      const plan = planFreeze({ lines: count.lines, onHand, settings, recentDifferences: recent, mode, signedAt: now });
      if (plan.missingCauses.length > 0) throw countError('CAUSE_REQUIRED', 'Pick a cause for every item outside the range.', { lineIds: plan.missingCauses });

      for (const p of plan.plans) await recordRepository.freezeLine(tx, p.lineId, p.freeze);
      if (selfSign) {
        for (const p of plan.plans) {
          if (!p.post) continue;
          await postStockMovement(tx, {
            type: 'ADJUSTMENT',
            locationId: count.locationId,
            inventoryItemId: p.itemId,
            quantity: p.post.quantity,
            unitCost: p.post.unitCost,
            reason: p.post.reason,
            userId: actor.id,
            links: { countLineId: p.lineId },
          });
        }
      }
      await recordRepository.markSigned(tx, countId, {
        status: selfSign ? 'APPROVED' : 'SUBMITTED',
        signedAt: now,
        selfSigned: selfSign,
        approverId: selfSign ? actor.id : null,
        approvedAt: selfSign ? now : null,
        idempotencyKey: signedWith(count.idempotencyKey, input.idempotencyKey),
        rangeKes: settings.rangeKes,
        rangePercent: settings.rangePercent,
        directorAlertKes: settings.directorAlertKes,
        flagRepeat: settings.flagRepeat,
        lastSavedAt: count.updatedAt,
      });

      const record = (await recordRepository.findById(siteId, countId, tx))!;
      return {
        record,
        replay: false as const,
        alertLines: plan.plans.filter((p) => p.alertValueKes !== null).map((p) => ({ itemName: p.itemName, valueKes: p.alertValueKes! })),
        alertKes: settings.directorAlertKes,
        itemsCounted: count.lines.filter((l) => l.countedQty !== null).length,
      };
    });

    if (outcome.replay) return replayed(outcome.record);

    // After the commit, fire and forget: a push must never fail or hold up a signed count.
    if (selfSign) {
      void countNotify.directorAlert({ countId, reference: outcome.record.reference, signerName: holder.name, alertKes: outcome.alertKes, lines: outcome.alertLines }, now);
    } else {
      void countNotify.submitted(siteId, { countId, reference: outcome.record.reference, counterName: holder.name, itemsCounted: outcome.itemsCounted });
    }
    return { detail: await readCountDetail(actor, siteId, outcome.record, now), replayed: false };
  },

  /** C14: this person's own section order, for today only (tomorrow it is the Manager's again). */
  setSectionOrder: async (actor: Actor, input: SectionOrderInput, now: Date = new Date()): Promise<SectionOrderResult> => {
    const siteId = await requireHubActor(actor);
    const ids = [...new Set(input.sectionIds)];
    const found = await recordRepository.sectionsByIds(siteId, ids);
    if (found.length !== ids.length) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');
    const today = nairobiDay(now);
    await recordRepository.saveDayOrder(siteId, actor.id, today, ids);
    return { sectionIds: ids, appliesTo: today };
  },
};
