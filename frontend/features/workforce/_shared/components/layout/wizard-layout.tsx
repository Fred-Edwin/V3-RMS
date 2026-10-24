import * as React from 'react';

import { cn } from '@/lib/cn';

import { CompletenessRing } from '../people/completeness-ring';

/**
 * Stepper wizard layout (Paper "Add employee", R5O-0): a top line with the
 * breadcrumb and "Saved as a draft as you go", steps on the left, the form in
 * the centre, "The file so far" on the right, and a footer with the step count
 * and the actions. Steps and words are props, so any multi-step flow reuses it.
 *
 * On a phone the steps rail and the right panel stack above and below the form.
 */
export type StepState = 'done' | 'current' | 'upcoming';

export interface WizardStep {
  key: string;
  label: string;
  state: StepState;
}

export function StepRail({ title, steps }: { title: string; steps: WizardStep[] }) {
  return (
    <nav aria-label={title} className="flex w-[250px] shrink-0 flex-col border-r border-wds-border px-7 py-9 max-md:w-full max-md:border-b max-md:border-r-0 max-md:py-5">
      <div className="pb-[18px] font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-text-secondary">{title}</div>
      <ol className="flex flex-col max-md:flex-row max-md:flex-wrap max-md:gap-4">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className={cn('flex gap-3.5', !last && 'h-14 max-md:h-auto')}>
              <span className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-wds-mono text-[11px] leading-[14px]',
                    s.state === 'current' &&
                      'bg-wds-primary text-wds-primary-fg shadow-[0_0_0_3px_var(--wds-canvas),0_0_0_4px_var(--wds-primary)]',
                    s.state === 'upcoming' && 'border border-wds-neutral-400 text-wds-text-secondary',
                    s.state === 'done' && 'bg-wds-success-fg text-wds-primary-fg'
                  )}
                >
                  {s.state === 'done' ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {last ? null : <span aria-hidden className="mt-1.5 w-px grow bg-wds-border-strong max-md:hidden" />}
              </span>
              <span
                className={cn(
                  'pt-px font-wds-sans text-[14px] leading-[18px]',
                  s.state === 'current' ? 'font-semibold text-wds-text-ink' : 'text-wds-text-secondary'
                )}
              >
                {s.label}
                <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (current step)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface FileSoFarRow {
  key: string;
  label: string;
  value: string;
  /** `progress` colours the value warning ("In progress"). */
  tone?: 'default' | 'progress';
}

export function FileSoFarPanel({
  title,
  percent,
  note,
  rows,
}: {
  title: string;
  percent: number;
  note: string;
  rows: FileSoFarRow[];
}) {
  return (
    <aside aria-label={title} className="flex flex-1 flex-col gap-5 border-l border-wds-border bg-wds-neutral-50 px-8 py-9 max-md:border-l-0 max-md:border-t max-md:py-6">
      <div className="font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-text-secondary">{title}</div>
      <div className="flex items-center gap-4">
        <CompletenessRing percent={percent} size={64} variant="progress" />
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-neutral-700">{note}</p>
      </div>
      <dl className="flex flex-col border-t border-wds-border">
        {rows.map((r, i) => (
          <div key={r.key} className={cn('flex justify-between py-2.5', i < rows.length - 1 && 'border-b border-wds-border')}>
            <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.label}</dt>
            <dd className={cn('font-wds-sans text-[13px] leading-4', r.tone === 'progress' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** "Saved as a draft as you go" (top line). `saving` is shown while a save is in flight. */
export function DraftIndicator({ text, saving = false }: { text: string; saving?: boolean }) {
  return (
    <span role="status" aria-live="polite" className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
      {saving ? 'Saving…' : text}
    </span>
  );
}

/** Top line: breadcrumb on the left, the draft indicator on the right. */
export function WizardTopBar({ crumbs, draft }: { crumbs: [string, string]; draft: React.ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-wds-border px-6 max-md:px-4">
      <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{crumbs[0]}</span>
      <span aria-hidden className="font-wds-sans text-[14px] leading-[18px] text-wds-neutral-400">/</span>
      <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{crumbs[1]}</span>
      <span className="ml-auto">{draft}</span>
    </div>
  );
}

/**
 * Footer: "Step 1 of 5" at the left of the form column, actions at the right.
 * Put the single brown button last (rule 04); everything else is outlined.
 */
export function WizardFooter({ stepText, actions }: { stepText: string; actions: React.ReactNode }) {
  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-t border-wds-border pl-[298px] pr-12 max-md:h-auto max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:px-4 max-md:py-3">
      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{stepText}</span>
      <div className="flex gap-2.5 max-md:flex-col-reverse">{actions}</div>
    </div>
  );
}

export function WizardLayout({
  topBar,
  rail,
  form,
  panel,
  footer,
  className,
}: {
  topBar: React.ReactNode;
  rail: React.ReactNode;
  form: React.ReactNode;
  panel: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-0 w-full flex-col bg-wds-surface', className)}>
      {topBar}
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        {rail}
        <div className="flex w-[560px] shrink-0 flex-col gap-5 px-12 py-9 max-md:w-full max-md:px-4 max-md:py-6">{form}</div>
        {panel}
      </div>
      {footer}
    </div>
  );
}
