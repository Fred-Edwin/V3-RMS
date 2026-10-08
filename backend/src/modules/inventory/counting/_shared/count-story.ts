import { Prisma } from '@prisma/client';
import type { CountCause } from './counting-contract';
import { clockText, daysBetween, lastCountedText, weekdayDateText } from './count-time';

/**
 * "What the records show" for an outside-range line, and the one cause it may suggest (brief, "The story and suggested
 * cause"). Between the item's previous counted time (or 7 days back when never counted) and the counter's sign time, the first
 * of these that applies is the story:
 *   1. a dispatch of the item left the Central Store;
 *   2. a prep run used it;
 *   3. a delivery brought it in;
 *   4. it is an input of a prep recipe and nothing consumed it for 7 days (the only case that SUGGESTS a cause);
 *   5. otherwise, no movement.
 * Pure: the facts come from `count-story-repository.ts`.
 */
export const STORY_WINDOW_DAYS = 7;

export type DispatchFact = { label: string; toSiteName: string; quantity: Prisma.Decimal; confirmed: boolean; at: Date };
export type PrepFact = { reference: string; quantity: Prisma.Decimal; at: Date };
export type DeliveryFact = { reference: string; quantity: Prisma.Decimal; at: Date };

export type StoryFacts = {
  itemName: string;
  unit: string;
  /** The counter's sign time: where "today" and "yesterday" are measured from. */
  signedAt: Date;
  lastCountedAt: Date | null;
  dispatches: readonly DispatchFact[];
  prepRuns: readonly PrepFact[];
  deliveries: readonly DeliveryFact[];
  isPrepRecipeInput: boolean;
  /** Any prep consumption of the item in the 7 days before the sign. */
  usedInPrepLastWeek: boolean;
};

export type Story = { story: string; suggestedCause: CountCause | null };

const qty = (value: Prisma.Decimal, unit: string): string => `${value.abs().toDecimalPlaces(2).toString()} ${unit}`;

const ZERO = new Prisma.Decimal(0);
const sum = (values: readonly Prisma.Decimal[]): Prisma.Decimal => values.reduce((total, v) => total.plus(v.abs()), ZERO);

const latest = <T extends { at: Date }>(rows: readonly T[]): T => rows.reduce((a, b) => (b.at > a.at ? b : a));

/** "today", "yesterday", "on Fri 9 Oct" */
const whenText = (at: Date, signedAt: Date): string => {
  const days = daysBetween(at, signedAt);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `on ${weekdayDateText(at)}`;
};

const list = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** "Sugar, white" is spoken of as "sugar". */
const spokenName = (name: string): string => (name.split(',')[0] ?? name).trim().toLowerCase();

const dispatchStory = (facts: StoryFacts): string => {
  const rows = facts.dispatches;
  const labels = [...new Set(rows.map((d) => d.label))];
  const byBranch = new Map<string, Prisma.Decimal>();
  for (const d of rows) byBranch.set(d.toSiteName, (byBranch.get(d.toSiteName) ?? ZERO).plus(d.quantity.abs()));
  const split = byBranch.size > 1 ? ` (${[...byBranch].map(([branch, q]) => `${branch} ${q.toDecimalPlaces(2).toString()}`).join(', ')})` : '';
  const confirmed = rows.every((d) => d.confirmed);
  const confirmText = confirmed
    ? byBranch.size > 1
      ? 'Both branches confirmed.'
      : 'The branch confirmed.'
    : 'Not every branch has confirmed yet.';
  return `${qty(sum(rows.map((d) => d.quantity)), facts.unit)} sent ${whenText(latest(rows).at, facts.signedAt)} in ${list(labels)}${split}. ${confirmText}`;
};

const prepStory = (facts: StoryFacts): string => {
  const runs = facts.prepRuns;
  const last = latest(runs);
  const when = `${whenText(last.at, facts.signedAt)} at ${clockText(last.at)}`;
  if (runs.length === 1) return `Prep run ${last.reference} used ${qty(last.quantity, facts.unit)} ${when}.`;
  const refs = [...runs].sort((a, b) => a.at.getTime() - b.at.getTime()).map((r) => r.reference);
  return `Prep runs ${list(refs)} used ${qty(sum(runs.map((r) => r.quantity)), facts.unit)} in total, the latest ${when}.`;
};

const deliveryStory = (facts: StoryFacts): string => {
  const rows = facts.deliveries;
  const last = latest(rows);
  const refs = [...new Set([...rows].sort((a, b) => a.at.getTime() - b.at.getTime()).map((r) => r.reference))];
  return `${qty(sum(rows.map((r) => r.quantity)), facts.unit)} received ${whenText(last.at, facts.signedAt)} in ${list(refs)}.`;
};

export const storyFor = (facts: StoryFacts): Story => {
  if (facts.dispatches.length > 0) return { story: dispatchStory(facts), suggestedCause: null };
  if (facts.prepRuns.length > 0) return { story: prepStory(facts), suggestedCause: null };
  if (facts.deliveries.length > 0) return { story: deliveryStory(facts), suggestedCause: null };
  if (facts.isPrepRecipeInput && !facts.usedInPrepLastWeek) {
    const counted = facts.lastCountedAt ? `Last counted ${lastCountedText(facts.lastCountedAt, facts.signedAt).toLowerCase()}.` : 'Never counted before.';
    return { story: `No prep use logged for ${spokenName(facts.itemName)} this week. ${counted}`, suggestedCause: 'PREP_NOT_LOGGED' };
  }
  return { story: 'No movement since the last count.', suggestedCause: null };
};
