import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';

const PREP_HOME = '/app/inventory/prep';

const Chevron = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d="M15 6l-6 6 6 6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface FixHeaderProps {
  title: string;
  subtitle: string;
  initials: string;
  /** The desktop breadcrumb's last segment ("Fix run", "Correct run"). */
  screen: string;
  desktop: boolean;
  onBack: () => void;
  /** Shown as "Cancel" on the dark header and on the desktop bar (Paper step 14 draws it; the detail step 13 does not). */
  onLeave?: () => void;
}

/**
 * The header of the Attendant's Fix a slip screens. Phone (Paper `7Y7-0`, `7ZQ-0`): back chevron, "WENDO RMS · HUB", an optional
 * Cancel, the avatar, then the title and "PREP-0130 · today 07:20". Tablet: one 56px bar. Computer: the shell Topbar. No status bar,
 * no bottom tabs (docs/UI_BUILD_RULES.md 7a).
 */
export function FixHeader({ title, subtitle, initials, screen, desktop, onBack, onLeave }: FixHeaderProps) {
  if (desktop) {
    return (
      <Topbar
        breadcrumb={{ root: 'Central Store', section: 'Prep', sectionHref: PREP_HOME, screen }}
        hideSearch
        className="shrink-0"
        actions={
          <Button variant="secondary" onClick={onLeave ?? onBack}>
            {onLeave ? 'Cancel' : 'Back'}
          </Button>
        }
      />
    );
  }
  return (
    <>
      <header className="flex shrink-0 flex-col gap-wds-2.5 bg-wds-sidebar-top px-wds-4 pb-[18px] pt-wds-4 sm:hidden">
        <div className="flex items-center gap-wds-3">
          <button type="button" onClick={onBack} aria-label="Back" className="-m-2 flex rounded-wds-sm p-2 outline-none focus-visible:shadow-wds-ring">
            <Chevron />
          </button>
          <span className="flex-1 font-wds-mono text-wds-field-label uppercase tracking-[0.08em] text-wds-espresso-400">Wendo RMS · Hub</span>
          {onLeave ? (
            <button type="button" onClick={onLeave} className="-my-2 mr-1.5 min-h-11 px-1 font-wds-sans text-wds-body text-wds-sidebar-fg-item outline-none focus-visible:shadow-wds-ring">
              Cancel
            </button>
          ) : null}
          <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-wds-espresso-800 font-wds-mono text-wds-field-label text-[#EBDFD6]">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="break-words font-wds-sans text-[22px] font-semibold leading-7 text-white">{title}</h1>
          <p className="font-wds-sans text-wds-body-sm leading-[18px] text-wds-sidebar-fg-item">{subtitle}</p>
        </div>
      </header>
      <header className="hidden h-14 shrink-0 items-center gap-wds-3 bg-wds-sidebar-top px-wds-5 sm:flex">
        <button type="button" onClick={onBack} aria-label="Back" className="-m-2 flex rounded-wds-sm p-2 outline-none focus-visible:shadow-wds-ring">
          <Chevron />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline gap-wds-3">
          <h1 className="truncate font-wds-sans text-[16px] font-semibold leading-5 text-white">{title}</h1>
          <span className="truncate font-wds-sans text-wds-body-sm text-wds-sidebar-fg-item">{subtitle}</span>
        </div>
        {onLeave ? (
          <button type="button" onClick={onLeave} className="min-h-11 px-1 font-wds-sans text-wds-body text-wds-sidebar-fg-item outline-none focus-visible:shadow-wds-ring">
            Cancel
          </button>
        ) : null}
      </header>
    </>
  );
}
