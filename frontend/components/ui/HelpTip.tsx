'use client'

import { HelpCircle } from 'lucide-react'
import { Popover } from './Popover'

interface HelpTipProps {
  /** Short heading, e.g. the page or section name. */
  title: string
  /** 2-4 concise sentences — plain language, no jargon. Keep it short. */
  children: React.ReactNode
  className?: string
  /** Override the trigger button's styling — use for dark/espresso headers. */
  triggerClassName?: string
}

/**
 * Small "?" affordance for a page header — opens a concise, static explainer
 * popover (not a guided tour; see `usePageTour`/`TourButton` for that pattern).
 * Use when a screen has a non-obvious rule or purpose that's cheaper to
 * explain once here than to re-explain to every new user in person.
 */
export function HelpTip({ title, children, className, triggerClassName }: HelpTipProps) {
  return (
    <Popover
      placement="bottom-end"
      className={className}
      trigger={
        <button
          type="button"
          aria-label={`Help: ${title}`}
          className={
            triggerClassName ??
            'flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-espresso focus-visible:outline-none focus-visible:shadow-focus'
          }
        >
          <HelpCircle size={17} strokeWidth={2} aria-hidden />
        </button>
      }
    >
      <div className="w-[320px] px-4 py-3.5">
        <p className="mb-1.5 text-label-md font-semibold text-stone-900">{title}</p>
        <div className="space-y-2 text-body-sm leading-relaxed text-stone-600">{children}</div>
      </div>
    </Popover>
  )
}
