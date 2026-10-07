import * as React from 'react';

/**
 * The record form's own header on a phone and a tablet (the desktop uses the shell `Topbar`). No status bar and no bottom tabs
 * (docs/UI_BUILD_RULES.md 7a): it starts at the app's own header.
 *  - Phone (Paper `1UL4-0`): back chevron, "WENDO RMS · HUB", Cancel and the avatar, then the title and subtitle.
 *  - Tablet (Paper `1UJ3-0`): one bar with the chevron, the title and Cancel.
 */
const Chevron = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d="M15 6l-6 6 6 6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function RunFormHeader({ title, subtitle, initials, onBack, onCancel }: { title: string; subtitle: string; initials: string; onBack: () => void; onCancel: () => void }) {
  return (
    <>
      <header className="flex shrink-0 flex-col gap-wds-2.5 bg-wds-sidebar-top px-wds-4 pb-[18px] pt-wds-4 sm:hidden">
        <div className="flex items-center gap-wds-3">
          <button type="button" onClick={onBack} aria-label="Back" className="flex rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
            <Chevron />
          </button>
          <span className="flex-1 font-wds-mono text-wds-field-label uppercase tracking-[0.08em] text-wds-espresso-400">Wendo RMS · Hub</span>
          <button type="button" onClick={onCancel} className="mr-1.5 font-wds-sans text-wds-body text-wds-sidebar-fg-item outline-none focus-visible:shadow-wds-ring">
            Cancel
          </button>
          <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-wds-espresso-800 font-wds-mono text-wds-field-label text-[#EBDFD6]">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-wds-sans text-[22px] font-semibold leading-7 text-white">{title}</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-sidebar-fg-item">{subtitle}</p>
        </div>
      </header>
      <header className="hidden h-14 shrink-0 items-center gap-wds-3 bg-wds-sidebar-top px-wds-5 sm:flex lg:hidden">
        <button type="button" onClick={onBack} aria-label="Back" className="flex rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
          <Chevron />
        </button>
        <h1 className="flex-1 truncate font-wds-sans text-[16px] font-semibold leading-5 text-white">{title}</h1>
        <button type="button" onClick={onCancel} className="font-wds-sans text-wds-body text-wds-sidebar-fg-item outline-none focus-visible:shadow-wds-ring">
          Cancel
        </button>
      </header>
    </>
  );
}
