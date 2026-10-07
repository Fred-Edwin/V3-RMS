import type { Request } from 'express';
import type { InventoryItemType } from '@prisma/client';
import { actorCan } from '../../_shared/central-store-access';
import { firstNameOf, roleLabelOf, toPerson } from '../_shared/count-people';
import { dateClockText } from '../_shared/count-time';
import type { MoveView, SetupView } from '../_shared/counting-contract';
import type { MoveRow, SectionRow } from './setup-repository';

type Actor = NonNullable<Request['user']>;

/** An item not counted for this many whole days is drawn amber ("6 days ago"). An item never counted is not "stale": its text says so. */
export const STALE_DAYS = 5;
/** A move is shown on its item ("Moved here from …") for this many days, as long as it was not undone. */
export const MOVE_SHOWN_DAYS = 14;

export const TYPE_TEXT: Record<InventoryItemType, string> = { RAW_INGREDIENT: 'Raw ingredient', PREPPED: 'Prepped', STOCKED: 'Stocked' };

/** "Moved here from Summer by Linnet · 13 Oct 07:12", or "Placed here by Linnet · …" when the item came from "Not in any section". */
export const moveText = (move: Pick<MoveRow, 'fromSectionName' | 'movedBy' | 'movedAt'>): string =>
  `${move.fromSectionName ? `Moved here from ${move.fromSectionName}` : 'Placed here'} by ${firstNameOf(move.movedBy.name)} · ${dateClockText(move.movedAt)}`;

export const moveView = (move: MoveRow, actor: Actor): MoveView => ({
  id: move.id,
  itemId: move.itemId,
  itemName: move.itemName,
  fromSectionId: move.fromSectionId,
  fromSectionName: move.fromSectionName,
  toSectionId: move.toSectionId,
  toSectionName: move.toSectionName,
  by: toPerson(move.movedBy),
  at: move.movedAt.toISOString(),
  undone: move.undoneAt !== null,
  text: moveText(move),
  can: { undo: move.undoneAt === null && actorCan(actor, 'counts.setup') },
});

const items = (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`;

/** "1 item moved by the Attendant since your last visit." (one role moved them), else "2 items moved since your last visit." */
export const movedTextOf = (moves: readonly MoveRow[]): string | null => {
  if (moves.length === 0) return null;
  const roles = new Set(moves.map((m) => roleLabelOf(m.movedBy.role)));
  if (roles.size === 1) return `${items(moves.length)} moved by the ${[...roles][0]!.replace(/^Store /, '')} since your last visit.`;
  return `${items(moves.length)} moved since your last visit.`;
};

export type SetupViewInput = {
  version: string;
  sections: readonly SectionRow[];
  unsectionedCount: number;
  /** Moves by other people since this person's last visit that still stand. */
  moved: readonly MoveRow[];
  actor: Actor;
};

/** C15: the whole Count setup page, minus the open section's items. */
export const buildSetupView = (input: SetupViewInput): SetupView => ({
  version: input.version,
  sections: input.sections.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    supplierName: s.supplierName,
    itemCount: s.itemCount,
    position: s.position,
    tagText: s.kind === 'MANUAL' ? 'manual section' : null,
  })),
  unsectioned: {
    count: input.unsectionedCount,
    text: input.unsectionedCount === 0 ? 'Every item is in a section' : `${items(input.unsectionedCount).replace('item', 'new item')} · never counted until placed`,
  },
  movedSinceLastVisit: input.moved.map((m) => moveView(m, input.actor)),
  movedText: movedTextOf(input.moved),
  can: { edit: actorCan(input.actor, 'counts.setup') },
});
