import type { Request } from 'express';
import type { DepartmentTag, InventoryItemType } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { countError } from '../_shared/count-errors';
import { adoptNewItems } from '../_shared/count-sections';
import { daysBetween, lastCountedText } from '../_shared/count-time';
import type { AddItemsList, SectionItems } from '../_shared/counting-contract';
import { setupRepository, type ItemFacts, type MoveRow } from './setup-repository';
import { layoutVersion } from './setup-version';
import { MOVE_SHOWN_DAYS, STALE_DAYS, TYPE_TEXT, buildSetupView, moveView } from './setup-view';
import type { AddItemsInput, AddItemsQuery, AddSectionInput, LayoutInput, MoveItemInput, MoveView, SetupView } from './setup.types';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Moves by others are listed "since your last visit"; a first visit looks back this far. */
const FIRST_VISIT_DAYS = 7;
const UNSECTIONED = 'unsectioned';
export const UNSECTIONED_NAME = 'Not in any section';

const ITEM_TYPES = ['RAW_INGREDIENT', 'PREPPED', 'STOCKED'] as const;
const DEPARTMENT_TAGS = ['KITCHEN', 'BARISTA', 'PIZZA', 'PASTRY'] as const;

/** The layout as it stands: what the version stamps and what a layout save is checked against. */
const readLayout = async (siteId: string, client: Parameters<typeof setupRepository.listSections>[1] = prisma) => {
  const [sections, placed, unsectioned] = await Promise.all([
    setupRepository.listSections(siteId, client),
    setupRepository.listPlacedItems(siteId, null, client),
    setupRepository.unsectionedItems(siteId, client),
  ]);
  const version = layoutVersion({
    sections: sections.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    placements: placed.map((p) => ({ itemId: p.itemId, sectionId: p.sectionId, position: p.position })),
    unsectionedItemIds: unsectioned.map((i) => i.id),
  });
  return { sections, placed, unsectioned, version };
};

/** C15's view, without stamping the visit (every write returns it too). */
const buildView = async (siteId: string, actor: Actor, now: Date): Promise<SetupView> => {
  const layout = await readLayout(siteId);
  const lastVisit = await setupRepository.lastVisit(siteId, actor.id);
  const since = lastVisit ?? new Date(now.getTime() - FIRST_VISIT_DAYS * DAY_MS);
  const moved = await setupRepository.movesSince(siteId, since, actor.id);
  return buildSetupView({ version: layout.version, sections: layout.sections, unsectionedCount: layout.unsectioned.length, moved, actor });
};

const itemNotInSetup = (): Error => countError('ITEM_NOT_IN_SETUP', 'That item is not in the catalog any more.');

export const setupService = {
  /** C15: the whole page. Places new supplier items first, and stamps this person's visit AFTER reading, so "moved since your last visit" is honest. */
  view: async (actor: Actor, now: Date = new Date()): Promise<SetupView> => {
    const siteId = await requireHubReader(actor);
    await adoptNewItems(siteId);
    const view = await buildView(siteId, actor, now);
    await setupRepository.stampVisit(siteId, actor.id, now);
    return view;
  },

  /** C16: one section's items on one list, or the items in no section. */
  sectionItems: async (actor: Actor, id: string, now: Date = new Date()): Promise<SectionItems> => {
    const siteId = await requireHubReader(actor);
    let name = UNSECTIONED_NAME;
    let facts: ItemFacts[];
    if (id === UNSECTIONED) {
      facts = await setupRepository.unsectionedItems(siteId);
    } else {
      const section = await setupRepository.findSection(siteId, id);
      if (!section) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');
      name = section.name;
      facts = (await setupRepository.listPlacedItems(siteId, [id])).map((i) => ({ id: i.itemId, name: i.name, unit: i.unit }));
    }

    const ids = facts.map((f) => f.id);
    const [lastCounted, latestMoves] = await Promise.all([setupRepository.lastCountedByItem(siteId, ids), setupRepository.latestMoveByItem(siteId, ids)]);
    return {
      section: { id, name, itemCount: facts.length },
      items: facts.map((item) => {
        const last = lastCounted.find((c) => c.itemId === item.id)?.at ?? null;
        const move: MoveRow | undefined = latestMoves.get(item.id);
        const shown = move && move.undoneAt === null && move.toSectionId === id && now.getTime() - move.movedAt.getTime() <= MOVE_SHOWN_DAYS * DAY_MS;
        return {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          lastCountedAt: last ? last.toISOString() : null,
          lastCountedText: lastCountedText(last, now),
          stale: last !== null && daysBetween(last, now) >= STALE_DAYS,
          movedHere: shown ? moveView(move, actor) : null,
        };
      }),
    };
  },

  /** C17: a new manual section, last in the shelf order. */
  addSection: async (actor: Actor, input: AddSectionInput, now: Date = new Date()): Promise<SetupView> => {
    const siteId = await requireHubActor(actor);
    if (await setupRepository.nameTaken(siteId, input.name)) throw countError('SECTION_NAME_TAKEN', `There is already a section called ${input.name.trim()}.`);
    await prisma.$transaction(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      if (await setupRepository.nameTaken(siteId, input.name, tx)) throw countError('SECTION_NAME_TAKEN', `There is already a section called ${input.name.trim()}.`);
      await setupRepository.createSection(tx, siteId, input.name);
    });
    return buildView(siteId, actor, now);
  },

  /**
   * C18: "Save order". One transaction under a lock. A stale `version` is 409 LAYOUT_CHANGED (someone, perhaps an Attendant, moved
   * an item since this page loaded). Items that change section here are logged as the caller's moves; an item inside an OPEN count
   * keeps its line in that count (the count's lines are copies).
   */
  saveLayout: async (actor: Actor, input: LayoutInput, now: Date = new Date()): Promise<SetupView> => {
    const siteId = await requireHubActor(actor);
    await prisma.$transaction(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      const layout = await readLayout(siteId, tx);
      if (layout.version !== input.version) throw countError('LAYOUT_CHANGED', 'Count setup changed since you opened it. Reload it and try again.');

      const sectionIds = layout.sections.map((s) => s.id);
      const named = input.sections.filter((s) => s.id !== UNSECTIONED);
      const namedIds = named.map((s) => s.id);
      if (new Set(namedIds).size !== namedIds.length || namedIds.length !== sectionIds.length || !namedIds.every((id) => sectionIds.includes(id))) {
        throw new ValidationError('The layout must list every section exactly once.');
      }
      if (input.sections.filter((s) => s.id === UNSECTIONED).length > 1) throw new ValidationError('"Not in any section" is listed twice.');

      const listed = input.sections.flatMap((s) => s.itemIds);
      if (new Set(listed).size !== listed.length) throw new ValidationError('An item is listed more than once.');
      const live = new Set((await setupRepository.liveItems(siteId, listed, tx)).map((i) => i.id));
      if (!listed.every((id) => live.has(id))) throw itemNotInSetup();

      const currentSection = new Map(layout.placed.map((p) => [p.itemId, p.sectionId]));
      const unsectionedNow = new Set(layout.unsectioned.map((i) => i.id));
      const underUnsectioned = input.sections.find((s) => s.id === UNSECTIONED)?.itemIds ?? [];
      if (!underUnsectioned.every((id) => unsectionedNow.has(id))) throw new ValidationError('An item cannot be moved out of its section into "Not in any section".');

      // Items left out of the payload keep their section, after the listed ones, in their current order.
      const target = new Map<string, string[]>(named.map((s) => [s.id, [...s.itemIds]]));
      for (const placement of layout.placed) {
        if (listed.includes(placement.itemId)) continue;
        target.get(placement.sectionId)?.push(placement.itemId);
      }

      const inserts: { itemId: string; sectionId: string; position: number; addedById: string | null }[] = [];
      const rewrites: { itemId: string; sectionId: string; position: number }[] = [];
      const moves: { itemId: string; fromSectionId: string | null; toSectionId: string; movedById: string; movedAt: Date }[] = [];
      const oldPosition = new Map(layout.placed.map((p) => [p.itemId, p.position]));
      for (const [sectionId, itemIds] of target) {
        itemIds.forEach((itemId, position) => {
          const from = currentSection.get(itemId) ?? null;
          if (from === null) {
            inserts.push({ itemId, sectionId, position, addedById: actor.id });
            moves.push({ itemId, fromSectionId: null, toSectionId: sectionId, movedById: actor.id, movedAt: now });
          } else if (from !== sectionId || oldPosition.get(itemId) !== position) {
            rewrites.push({ itemId, sectionId, position });
            if (from !== sectionId) moves.push({ itemId, fromSectionId: from, toSectionId: sectionId, movedById: actor.id, movedAt: now });
          }
        });
      }

      await setupRepository.rewriteSectionPositions(tx, siteId, named.map((s, position) => ({ id: s.id, position })));
      await setupRepository.rewritePlacements(tx, siteId, rewrites);
      await setupRepository.insertPlacements(tx, siteId, inserts);
      await setupRepository.createMoves(tx, siteId, moves);
    });
    return buildView(siteId, actor, now);
  },

  /** C19: items that could be added to a section, searched as you type, filtered, paged. */
  addableItems: async (actor: Actor, query: AddItemsQuery): Promise<AddItemsList> => {
    const siteId = await requireHubActor(actor);
    const section = await setupRepository.findSection(siteId, query.sectionId);
    if (!section) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');
    if (query.type !== undefined && !(ITEM_TYPES as readonly string[]).includes(query.type)) throw new ValidationError('Unknown item type');
    if (query.departmentTag !== undefined && !(DEPARTMENT_TAGS as readonly string[]).includes(query.departmentTag)) throw new ValidationError('Unknown department');

    const result = await setupRepository.listAddable(
      siteId,
      {
        sectionId: query.sectionId,
        tab: query.tab,
        ...(query.q ? { q: query.q } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.type ? { type: query.type as InventoryItemType } : {}),
        ...(query.departmentTag ? { departmentTag: query.departmentTag as DepartmentTag } : {}),
      },
      { page: query.page, pageSize: query.pageSize },
    );
    return {
      rows: result.rows.map((r) => ({
        itemId: r.itemId,
        name: r.name,
        categoryName: r.categoryName,
        typeText: TYPE_TEXT[r.type],
        unit: r.unit,
        placement: r.section ? { kind: 'IN_SECTION' as const, sectionId: r.section.id, sectionName: r.section.name } : { kind: 'UNSECTIONED' as const, note: r.hasSupplier ? null : 'New, no supplier' },
      })),
      chips: result.chips,
      matchText: query.q ? `${result.total} ${result.total === 1 ? 'match' : 'matches'} for “${query.q}” · all sections` : null,
      page: { page: query.page, pageSize: query.pageSize, total: result.total },
    };
  },

  /** C20: adds items to the end of a section; an item in another section moves (and is logged). */
  addItems: async (actor: Actor, sectionId: string, input: AddItemsInput, now: Date = new Date()): Promise<SetupView> => {
    const siteId = await requireHubActor(actor);
    await prisma.$transaction(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      const section = await setupRepository.findSection(siteId, sectionId, tx);
      if (!section) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');
      const ids = [...new Set(input.itemIds)];
      const live = await setupRepository.liveItems(siteId, ids, tx);
      if (live.length !== ids.length) throw itemNotInSetup();

      const placements = await setupRepository.placementsOf(siteId, ids, tx);
      let next = await setupRepository.nextItemPosition(tx, sectionId);
      const rewrites: { itemId: string; sectionId: string; position: number }[] = [];
      const inserts: { itemId: string; sectionId: string; position: number; addedById: string | null }[] = [];
      const moves: { itemId: string; fromSectionId: string | null; toSectionId: string; movedById: string; movedAt: Date }[] = [];
      for (const itemId of ids) {
        const placed = placements.get(itemId);
        if (placed?.sectionId === sectionId) continue;
        if (placed) rewrites.push({ itemId, sectionId, position: next });
        else inserts.push({ itemId, sectionId, position: next, addedById: actor.id });
        moves.push({ itemId, fromSectionId: placed?.sectionId ?? null, toSectionId: sectionId, movedById: actor.id, movedAt: now });
        next += 1;
      }
      await setupRepository.rewritePlacements(tx, siteId, rewrites);
      await setupRepository.insertPlacements(tx, siteId, inserts);
      await setupRepository.createMoves(tx, siteId, moves);
    });
    return buildView(siteId, actor, now);
  },

  /**
   * C21: move one item to another section. Applies at once and is logged; the Manager sees it in Count setup and may undo it.
   * (The Attendant holds `counts.record`, the Manager both.) An item inside an OPEN count keeps its line in that count.
   */
  moveItem: async (actor: Actor, itemId: string, input: MoveItemInput, now: Date = new Date()): Promise<MoveView> => {
    const siteId = await requireHubActor(actor);
    const move = await prisma.$transaction(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      const [item] = await setupRepository.liveItems(siteId, [itemId], tx);
      if (!item) throw itemNotInSetup();
      const target = await setupRepository.findSection(siteId, input.toSectionId, tx);
      if (!target) throw new NotFoundError('Section not found', 'SECTION_NOT_FOUND');

      const placed = (await setupRepository.placementsOf(siteId, [itemId], tx)).get(itemId);
      if (placed?.sectionId === target.id) throw new ValidationError('That item is already in this section.');
      const position = await setupRepository.nextItemPosition(tx, target.id);
      if (placed) await setupRepository.rewritePlacements(tx, siteId, [{ itemId, sectionId: target.id, position }]);
      else await setupRepository.insertPlacements(tx, siteId, [{ itemId, sectionId: target.id, position, addedById: actor.id }]);
      return setupRepository.createMove(tx, siteId, { itemId, fromSectionId: placed?.sectionId ?? null, toSectionId: target.id, movedById: actor.id, movedAt: now });
    });
    return moveView(move, actor);
  },

  /** C22: the Manager takes a move back; the item returns to the section it came from (the end of it, or "Not in any section"). */
  undoMove: async (actor: Actor, moveId: string, now: Date = new Date()): Promise<SetupView> => {
    const siteId = await requireHubActor(actor);
    await prisma.$transaction(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      const move = await setupRepository.findMove(siteId, moveId, tx);
      if (!move) throw new NotFoundError('Move not found', 'MOVE_NOT_FOUND');
      if (move.undoneAt) throw countError('MOVE_ALREADY_UNDONE', 'That move was already undone.');

      // Only a move that still stands can be taken back: if the item has moved again, the layout is no longer what that move left.
      const placed = (await setupRepository.placementsOf(siteId, [move.itemId], tx)).get(move.itemId);
      if (placed?.sectionId !== move.toSectionId) throw countError('LAYOUT_CHANGED', 'That item has moved again since. Reload Count setup.');

      if (move.fromSectionId === null) {
        await setupRepository.deletePlacement(tx, siteId, move.itemId);
      } else {
        const position = await setupRepository.nextItemPosition(tx, move.fromSectionId);
        await setupRepository.rewritePlacements(tx, siteId, [{ itemId: move.itemId, sectionId: move.fromSectionId, position }]);
      }
      if (!(await setupRepository.markUndone(tx, siteId, move.id, actor.id, now))) throw countError('MOVE_ALREADY_UNDONE', 'That move was already undone.');
    });
    return buildView(siteId, actor, now);
  },
};
