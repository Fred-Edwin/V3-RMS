import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { storyFor, type StoryFacts } from './count-story';

const D = (v: number | string) => new Prisma.Decimal(v);
const at = (iso: string) => new Date(iso);

// The counter signed at 19:00 Nairobi on Tue 13 Oct 2026.
const signedAt = at('2026-10-13T16:00:00Z');

const facts = (overrides: Partial<StoryFacts> = {}): StoryFacts => ({
  itemName: 'Sugar, white',
  unit: 'kg',
  signedAt,
  lastCountedAt: at('2026-10-07T05:30:00Z'),
  dispatches: [],
  prepRuns: [],
  deliveries: [],
  isPrepRecipeInput: false,
  usedInPrepLastWeek: false,
  ...overrides,
});

describe('storyFor: the five rules, first that applies wins', () => {
  it('1. a dispatch: quantity, reference, branches, and whether they confirmed', () => {
    const result = storyFor(
      facts({
        unit: 'L',
        dispatches: [
          { label: 'Dispatch 4 · Nyeri Town · 13 Oct', toSiteName: 'Nyeri Town', quantity: D(-10), confirmed: true, at: at('2026-10-13T08:00:00Z') },
          { label: 'Dispatch 2 · Kimathi · 13 Oct', toSiteName: 'Kimathi', quantity: D(-10), confirmed: true, at: at('2026-10-13T08:30:00Z') },
        ],
      }),
    );
    expect(result.story).toBe('20 L sent today in Dispatch 4 · Nyeri Town · 13 Oct and Dispatch 2 · Kimathi · 13 Oct (Nyeri Town 10, Kimathi 10). Both branches confirmed.');
    expect(result.suggestedCause).toBeNull();
  });

  it('1. one dispatch not yet confirmed', () => {
    const result = storyFor(
      facts({ dispatches: [{ label: 'Dispatch 4 · Nyeri Town · 12 Oct', toSiteName: 'Nyeri Town', quantity: D(-5), confirmed: false, at: at('2026-10-12T08:00:00Z') }] }),
    );
    expect(result.story).toBe('5 kg sent yesterday in Dispatch 4 · Nyeri Town · 12 Oct. Not every branch has confirmed yet.');
  });

  it('1. a single confirmed dispatch says "The branch confirmed."', () => {
    const result = storyFor(
      facts({ dispatches: [{ label: 'Dispatch 1 · Kimathi · 9 Oct', toSiteName: 'Kimathi', quantity: D(-3), confirmed: true, at: at('2026-10-09T08:00:00Z') }] }),
    );
    expect(result.story).toBe('3 kg sent on Fri 9 Oct in Dispatch 1 · Kimathi · 9 Oct. The branch confirmed.');
  });

  it('2. a prep run: reference, quantity, when', () => {
    const result = storyFor(facts({ unit: 'tin', prepRuns: [{ reference: 'PREP-0409', quantity: D(-1), at: at('2026-10-12T13:05:00Z') }] }));
    expect(result.story).toBe('Prep run PREP-0409 used 1 tin yesterday at 16:05.');
    expect(result.suggestedCause).toBeNull();
  });

  it('2. several prep runs are added up', () => {
    const result = storyFor(
      facts({
        prepRuns: [
          { reference: 'PREP-0411', quantity: D(-2), at: at('2026-10-13T07:00:00Z') },
          { reference: 'PREP-0409', quantity: D(-1.5), at: at('2026-10-12T13:05:00Z') },
        ],
      }),
    );
    expect(result.story).toBe('Prep runs PREP-0409 and PREP-0411 used 3.5 kg in total, the latest today at 10:00.');
  });

  it('3. a delivery: quantity, date, GRN', () => {
    const result = storyFor(facts({ deliveries: [{ reference: 'GRN-0412', quantity: D(50), at: at('2026-10-09T09:00:00Z') }] }));
    expect(result.story).toBe('50 kg received on Fri 9 Oct in GRN-0412.');
    expect(result.suggestedCause).toBeNull();
  });

  it('4. a prep recipe input with no prep use for a week: says so and SUGGESTS "prep not logged"', () => {
    const result = storyFor(facts({ isPrepRecipeInput: true, usedInPrepLastWeek: false }));
    expect(result.story).toBe('No prep use logged for sugar this week. Last counted 6 days ago.');
    expect(result.suggestedCause).toBe('PREP_NOT_LOGGED');
  });

  it('4. never counted before', () => {
    const result = storyFor(facts({ isPrepRecipeInput: true, lastCountedAt: null }));
    expect(result.story).toBe('No prep use logged for sugar this week. Never counted before.');
    expect(result.suggestedCause).toBe('PREP_NOT_LOGGED');
  });

  it('4. last counted yesterday', () => {
    const result = storyFor(facts({ isPrepRecipeInput: true, lastCountedAt: at('2026-10-12T05:30:00Z') }));
    expect(result.story).toBe('No prep use logged for sugar this week. Last counted yesterday.');
  });

  it('5. otherwise: no movement, no suggestion', () => {
    expect(storyFor(facts())).toEqual({ story: 'No movement since the last count.', suggestedCause: null });
  });

  it('5. a recipe input that WAS used in prep this week (but not in the window) is not "prep not logged"', () => {
    expect(storyFor(facts({ isPrepRecipeInput: true, usedInPrepLastWeek: true }))).toEqual({
      story: 'No movement since the last count.',
      suggestedCause: null,
    });
  });
});

describe('storyFor: order of the rules', () => {
  const dispatch = { label: 'Dispatch 4 · Nyeri Town · 13 Oct', toSiteName: 'Nyeri Town', quantity: D(-10), confirmed: true, at: at('2026-10-13T08:00:00Z') };
  const prep = { reference: 'PREP-0409', quantity: D(-1), at: at('2026-10-12T13:05:00Z') };
  const delivery = { reference: 'GRN-0412', quantity: D(50), at: at('2026-10-09T09:00:00Z') };

  it('a dispatch beats a prep run, a delivery and the recipe rule', () => {
    expect(storyFor(facts({ dispatches: [dispatch], prepRuns: [prep], deliveries: [delivery], isPrepRecipeInput: true })).story).toMatch(/sent today/);
  });

  it('a prep run beats a delivery and the recipe rule', () => {
    expect(storyFor(facts({ prepRuns: [prep], deliveries: [delivery], isPrepRecipeInput: true })).story).toMatch(/^Prep run/);
  });

  it('a delivery beats the recipe rule, and only the recipe rule suggests a cause', () => {
    const result = storyFor(facts({ deliveries: [delivery], isPrepRecipeInput: true }));
    expect(result.story).toMatch(/received/);
    expect(result.suggestedCause).toBeNull();
  });
});
