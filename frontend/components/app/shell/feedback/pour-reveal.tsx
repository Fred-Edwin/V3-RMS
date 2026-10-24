import { cn } from '@/lib/cn';

/**
 * PourReveal — the branded loading mark for the auth-hydration gate
 * (`app/app/layout.tsx`'s `!role && !isHydrated` branch). Cross-feature,
 * not Inventory-specific — lives here alongside the other shared shell
 * composites for the same reason sidebar/topbar do.
 *
 * Designed and approved in Paper (Loading mark explorations, refined
 * "1 · Pour reveal" filmstrip, `U42-0`–`U45-0`) before this was built —
 * per the Feature Redo Playbook's design-first rule. The four Paper frames
 * (cup poised → pouring with drip bead → pour finishing → settled with
 * steam) are one continuous CSS-driven loop here, not four static states.
 *
 * Motion notes (premium-motion conventions, not decorative default CSS):
 * - Eased, not linear: cup tilt uses a spring-like ease-out/ease-in-out
 *   (`cubic-bezier(0.33,1,0.68,1)`), the fill sweep uses a symmetric
 *   ease-in-out (`cubic-bezier(0.65,0,0.35,1)`) so it accelerates into the
 *   sweep and decelerates into the settle rather than moving at a constant
 *   rate.
 * - Staggered, not synchronized: the two steam wisps loop on independent,
 *   offset timers (`wds-steam-2` starts 0.9s after `wds-steam-1`) so they
 *   never move in lockstep — two wisps drifting in unison reads as
 *   mechanical, offset ones read as organic.
 * - A deliberate hold at the settled frame (last ~8% of the cycle) before
 *   the loop restarts, instead of an abrupt cut back to frame 1 — an
 *   uninterrupted loop with no pause reads as a glitch, not a design.
 * - Every opacity value stays well under 100% (cup ~0.3, fill ~0.62, bead/
 *   steam ~0.3-0.4) — subtlety was an explicit design requirement, not an
 *   oversight.
 *
 * Reduced motion: falls back to the static settled frame (frame 4 — full
 * wordmark, cup + steam, no motion) via `motion-reduce:` variants on every
 * animated layer, the same convention `Skeleton` already uses for its
 * shimmer. Never animates for a user who's asked not to see animation.
 */
export function PourReveal({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center', className)} role="status" aria-label="Loading">
      <div className="relative h-[26px] w-[190px]">
        {/* Cup + steam — tilts in to pour, holds, tilts back upright to settle. */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          className="absolute -top-[30px] left-[67px] origin-[6px_20px] opacity-30 motion-reduce:rotate-0 animate-wds-pour-cup motion-reduce:animate-none"
        >
          <path
            d="M5 10 H17 V14.5 C17 17.5 14.8 20 12 20 H10 C7.2 20 5 17.5 5 14.5 Z"
            fill="none"
            stroke="var(--wds-espresso-600)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M17 11.5 H19 C20 11.5 20.7 12.2 20.7 13.2 C20.7 14.2 20 15 19 15 H17"
            fill="none"
            stroke="var(--wds-espresso-600)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M8.5 7 C8.5 5.3 10 5.3 10 3.6 C10 1.9 8.5 1.9 8.5 0.2"
            fill="none"
            stroke="var(--wds-caramel-500)"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="opacity-0 motion-reduce:opacity-100 animate-wds-steam-1 motion-reduce:animate-none"
          />
          <path
            d="M13.5 7 C13.5 5.3 15 5.3 15 3.6 C15 1.9 13.5 1.9 13.5 0.2"
            fill="none"
            stroke="var(--wds-caramel-500)"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="opacity-0 motion-reduce:opacity-100 animate-wds-steam-2 motion-reduce:animate-none"
          />
        </svg>

        {/* Stream + drip bead — falls from the cup's spout, lands on the pour front. */}
        <svg
          width="6"
          height="14"
          viewBox="0 0 6 14"
          className="absolute -top-2 left-16 opacity-0 motion-reduce:opacity-0 animate-wds-pour-bead motion-reduce:animate-none"
        >
          <line x1="3" y1="0" x2="3" y2="10" stroke="var(--wds-espresso-400)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          <circle cx="3" cy="12" r="1.4" fill="var(--wds-caramel-500)" />
        </svg>

        {/* Ghost base wordmark — always visible, the "unfilled" state. */}
        <div
          className="whitespace-nowrap text-[26px] font-semibold italic text-wds-border"
          style={{ fontFamily: 'var(--font-wordmark), serif', letterSpacing: '0.002em' }}
        >
          Wendo Coffee
        </div>

        {/* Filled overlay — clip-path sweeps left-to-right, then holds full. */}
        <div className="absolute left-0 top-0 h-full w-full overflow-hidden motion-reduce:[clip-path:none] animate-wds-pour-fill motion-reduce:animate-none">
          <div
            className="whitespace-nowrap text-[26px] font-semibold italic text-wds-espresso-600 opacity-[0.62]"
            style={{ fontFamily: 'var(--font-wordmark), serif', letterSpacing: '0.002em' }}
          >
            Wendo Coffee
          </div>
        </div>
      </div>

      <div
        className="mt-1.5 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-wds-espresso-600 opacity-45"
        style={{ width: 159, textAlign: 'center' }}
      >
        Bistro
      </div>
    </div>
  );
}
