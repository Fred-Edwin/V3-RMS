import { beforeEach, describe, expect, it } from 'vitest';

import { arrangeHome, canSeeCard, defineHomeCard, getHomeCards, inSlot, registerHomeCard, resetHomeCardsForTests, visibleCards, type CardDataState, type HomeCard } from './card-registry';
import type { WorkforceCapability } from './capabilities';

const Nothing = () => null;

const make = (id: string, over: Partial<Parameters<typeof defineHomeCard<number[]>>[0]> = {}): HomeCard =>
  defineHomeCard<number[]>({
    id,
    title: id,
    surfaces: ['desktop', 'phone'],
    slot: 'main',
    anyCapability: [],
    order: 10,
    isEmpty: (rows) => rows.length === 0,
    useData: () => ({ status: 'no-source' }),
    Card: Nothing,
    ...over,
  });

const holds =
  (...caps: WorkforceCapability[]) =>
  (c: WorkforceCapability): boolean =>
    caps.includes(c);

const ready = (data: number[]): CardDataState<unknown> => ({ status: 'ready', data });
const idsOf = (cards: { card: HomeCard }[]): string[] => cards.map((a) => a.card.id);

beforeEach(() => resetHomeCardsForTests());

describe('the registry', () => {
  it('lists cards in Paper order, not registration order', () => {
    registerHomeCard(make('b', { order: 20 }));
    registerHomeCard(make('a', { order: 10 }));
    expect(getHomeCards().map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('refuses two cards with the same id', () => {
    registerHomeCard(make('a'));
    expect(() => registerHomeCard(make('a'))).toThrow(/registered twice/);
  });
});

describe('who sees a card: by capability, never by role', () => {
  it('shows a card to someone who holds any one of its capabilities', () => {
    const card = make('waiting', { anyCapability: ['overtime.approve', 'leave.approve'] });
    expect(canSeeCard(card, 'desktop', holds('leave.approve'))).toBe(true);
    expect(canSeeCard(card, 'desktop', holds('overtime.approve'))).toBe(true);
    expect(canSeeCard(card, 'desktop', holds('rota.read'))).toBe(false);
    expect(canSeeCard(card, 'desktop', holds())).toBe(false);
  });

  it('shows a card with no capability to everyone', () => {
    expect(canSeeCard(make('week'), 'phone', holds())).toBe(true);
  });

  it('keeps a desktop-only card off the phone and the other way round', () => {
    const desktopOnly = make('people', { surfaces: ['desktop'] });
    const phoneOnly = make('clock', { surfaces: ['phone'] });
    expect(visibleCards([desktopOnly, phoneOnly], 'phone', holds()).map((c) => c.id)).toEqual(['clock']);
    expect(visibleCards([desktopOnly, phoneOnly], 'desktop', holds()).map((c) => c.id)).toEqual(['people']);
  });

  it('gives a department head the team cards and a plain member not', () => {
    const team = make('team-today', { anyCapability: ['today.read'] });
    const week = make('week');
    const head = holds('today.read', 'time.own');
    const member = holds('time.own');
    expect(visibleCards([team, week], 'phone', head).map((c) => c.id)).toEqual(['team-today', 'week']);
    expect(visibleCards([team, week], 'phone', member).map((c) => c.id)).toEqual(['week']);
  });
});

describe('what the page draws', () => {
  const a = make('shift', { order: 10, slot: 'main' });
  const b = make('waiting', { order: 20, slot: 'side', urgency: (rows) => (rows.length > 2 ? 5 : 20) });
  const c = make('week', { order: 50, slot: 'main' });

  it('orders by urgency, with Paper order breaking ties', () => {
    const calm = arrangeHome([a, b, c], { shift: ready([1]), waiting: ready([1]), week: ready([1]) });
    expect(idsOf(calm.cards)).toEqual(['shift', 'waiting', 'week']);
    // Three approvals waiting: the Waiting card rises above the shift card.
    const busy = arrangeHome([a, b, c], { shift: ready([1]), waiting: ready([1, 2, 3]), week: ready([1]) });
    expect(idsOf(busy.cards)).toEqual(['waiting', 'shift', 'week']);
  });

  it('leaves out a card with no data source yet', () => {
    const out = arrangeHome([a, b], { shift: { status: 'no-source' }, waiting: ready([1]) });
    expect(idsOf(out.cards)).toEqual(['waiting']);
  });

  it('leaves out a card whose answer is empty', () => {
    const out = arrangeHome([a, b], { shift: ready([]), waiting: ready([1]) });
    expect(idsOf(out.cards)).toEqual(['waiting']);
  });

  it('keeps a card that failed, so the person knows something is missing', () => {
    const out = arrangeHome([a, b], { shift: { status: 'error' }, waiting: ready([1]) });
    expect(out.errors.map((x) => x.id)).toEqual(['shift']);
    expect(out.page).toBe('ready');
  });

  it('says empty when nothing is left to show, and not before every card has answered', () => {
    expect(arrangeHome([a, b], { shift: { status: 'no-source' }, waiting: ready([]) }).page).toBe('empty');
    expect(arrangeHome([], {}).page).toBe('empty');
    expect(arrangeHome([a, b], { shift: { status: 'no-source' } }).page).toBe('loading');
    expect(arrangeHome([a, b], { shift: ready([1]) }).page).toBe('ready');
  });

  it('splits the drawn cards by desktop slot, keeping urgency order', () => {
    const out = arrangeHome([a, b, c], { shift: ready([1]), waiting: ready([1]), week: ready([1]) });
    expect(idsOf(inSlot(out, 'main'))).toEqual(['shift', 'week']);
    expect(idsOf(inSlot(out, 'side'))).toEqual(['waiting']);
    expect(inSlot(out, 'wide')).toEqual([]);
  });
});
