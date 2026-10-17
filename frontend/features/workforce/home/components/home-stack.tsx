'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, ListSkeleton } from '../../_shared';
import { arrangeHome, inSlot, visibleCards, type ArrangedHome, type CardDataState, type HomeCard, type HomeSurface } from '../lib/card-registry';
import type { WorkforceCapability } from '../../_shared';
import { HOME_COPY } from '../lib/home-copy';

/**
 * Draws the registered Home cards for one person: the cards they may see are mounted, each one's data hook runs, and the page is
 * arranged from what the hooks answer (`arrangeHome`: urgency order, cards with nothing to show left out, empty page).
 *
 * A hook cannot run in a loop, so each card gets a `CardProbe` that runs its hook and reports the answer up. The probes draw nothing;
 * the cards are drawn here, in order, so the page order is also the reading and tab order.
 */

function sameState(a: CardDataState<unknown> | undefined, b: CardDataState<unknown>): boolean {
  if (!a || a.status !== b.status) return false;
  return a.status === 'ready' && b.status === 'ready' ? a.data === b.data : true;
}

function CardProbe({ card, report }: { card: HomeCard; report: (id: string, state: CardDataState<unknown>) => void }) {
  const state = card.useData();
  React.useEffect(() => {
    report(card.id, state);
  }, [card.id, state, report]);
  return null;
}

export interface HomeStackProps {
  cards: readonly HomeCard[];
  surface: HomeSurface;
  can: (capability: WorkforceCapability) => boolean;
  /** Shown above the cards on the desktop page: the greeting and the sentence under it. */
  heading?: React.ReactNode;
}

export function HomeStack({ cards, surface, can, heading }: HomeStackProps) {
  const visible = React.useMemo(() => visibleCards(cards, surface, can), [cards, surface, can]);
  const [states, setStates] = React.useState<Record<string, CardDataState<unknown>>>({});
  const report = React.useCallback((id: string, next: CardDataState<unknown>) => {
    setStates((prev) => (sameState(prev[id], next) ? prev : { ...prev, [id]: next }));
  }, []);
  const arranged = React.useMemo(() => arrangeHome(visible, states), [visible, states]);

  return (
    <>
      {visible.map((card) => (
        <CardProbe key={card.id} card={card} report={report} />
      ))}
      <HomeLayout arranged={arranged} surface={surface} heading={heading} />
    </>
  );
}

/** The page from an arrangement. No hooks of its own beyond the kit's; the gallery draws it from fixtures. */
export function HomeLayout({ arranged, surface, heading }: { arranged: ArrangedHome; surface: HomeSurface; heading?: React.ReactNode }) {
  const body =
    arranged.page === 'loading' ? (
      <ListSkeleton rows={4} columns={[120, 'fill', 80]} label="Loading Home" />
    ) : arranged.page === 'empty' ? (
      <EmptyState kind="nothingYet" title={HOME_COPY.empty.title} line={HOME_COPY.empty.line} />
    ) : surface === 'phone' ? (
      <div className="flex flex-col gap-4">
        {arranged.cards.map((a) => (
          <React.Fragment key={a.card.id}>{a.card.render(a.data, surface)}</React.Fragment>
        ))}
        <CardErrors arranged={arranged} />
      </div>
    ) : (
      <DesktopColumns arranged={arranged} />
    );

  return (
    <div className={cn('flex flex-col', surface === 'phone' ? 'gap-4 px-4 pb-6 pt-4' : 'gap-6 px-8 py-7')}>
      {heading}
      {body}
    </div>
  );
}

function CardErrors({ arranged }: { arranged: ArrangedHome }) {
  return (
    <>
      {arranged.errors.map((card) => {
        const copy = HOME_COPY.cardError(card.title);
        return <ErrorBlock key={card.id} title={copy.title} line={copy.line} />;
      })}
    </>
  );
}

function DesktopColumns({ arranged }: { arranged: ArrangedHome }) {
  const kpi = inSlot(arranged, 'kpi');
  const main = inSlot(arranged, 'main');
  const side = inSlot(arranged, 'side');
  const wide = inSlot(arranged, 'wide');
  const sideWidth = side.reduce((w, a) => Math.max(w, a.card.sideWidth), 340);
  return (
    <>
      {kpi.map((a) => (
        <React.Fragment key={a.card.id}>{a.card.render(a.data, 'desktop')}</React.Fragment>
      ))}
      {main.length > 0 || side.length > 0 ? (
        <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start">
          <div className="flex min-w-0 grow basis-0 flex-col gap-6">
            {main.map((a) => (
              <React.Fragment key={a.card.id}>{a.card.render(a.data, 'desktop')}</React.Fragment>
            ))}
          </div>
          {side.length > 0 ? (
            <div className="flex w-full shrink-0 flex-col gap-6 lg:w-[var(--home-side)]" style={{ ['--home-side' as string]: `${sideWidth}px` }}>
              {side.map((a) => (
                <React.Fragment key={a.card.id}>{a.card.render(a.data, 'desktop')}</React.Fragment>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {wide.map((a) => (
        <React.Fragment key={a.card.id}>{a.card.render(a.data, 'desktop')}</React.Fragment>
      ))}
      <CardErrors arranged={arranged} />
    </>
  );
}
