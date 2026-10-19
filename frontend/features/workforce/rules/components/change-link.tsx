'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../_shared';
import { WHO_EDITS_HREF } from '../lib/tab-defs';
import { orList, roleInSentence, unique } from '../lib/rules-words';

/** The sentence in the popover: "Only A, B or C can change <thing>. Ask one of them." (Spec section 3). Never a person's name. */
export function lockedSentence(whoCan: readonly { role: string; organizationName?: string }[], thing: string): string {
  const names = unique(whoCan.map((w) => roleInSentence(w.role, w.organizationName)));
  if (names.length === 0) return `Nobody can change ${thing} here.`;
  const list = orList(names);
  return `Only ${list} can change ${thing}. Ask ${names.length === 1 ? list : 'one of them'}.`;
}

const OPEN_EVENT = 'wf-rules-popover-open';

/** The trailing slot of a rule row: Change, a padlocked Change that explains itself, or Fixed. */
export function ChangeLink({
  thing,
  state,
  onChange,
  offline = false,
}: {
  /** What the row sets, for the accessible name and the popover ("the grace period"). */
  thing: string;
  state: { kind: 'change' } | { kind: 'locked'; whoCan: { role: string; organizationName?: string }[] } | { kind: 'fixed' };
  onChange?: () => void;
  offline?: boolean;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [above, setAbove] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const card = React.useRef<HTMLDivElement>(null);

  // One popover at a time; a click elsewhere or Escape closes it and gives focus back.
  React.useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    const onOther = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== id) close();
    };
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!card.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener(OPEN_EVENT, onOther);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener(OPEN_EVENT, onOther);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, id]);

  if (state.kind === 'fixed') {
    return (
      <span aria-label="Fixed, set by the system" className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
        Fixed
      </span>
    );
  }

  if (state.kind === 'change') {
    return (
      <button
        type="button"
        onClick={onChange}
        disabled={offline}
        title={offline ? 'No connection' : undefined}
        aria-label={`Change ${thing}`}
        className={cn('font-wds-sans text-[13px] leading-4 text-wds-info-fg disabled:cursor-not-allowed disabled:opacity-60', MOTION, FOCUS_RING, onHover('underline'))}
      >
        Change
      </button>
    );
  }

  const text = lockedSentence(state.whoCan, thing);
  const toggle = (): void => {
    if (!open) {
      const rect = button.current?.getBoundingClientRect();
      setAbove(rect !== undefined && rect.bottom + 170 > window.innerHeight);
      document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    }
    setOpen(!open);
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change ${thing}, locked. ${text}`}
        aria-describedby={open ? `${id}-text` : undefined}
        className={cn('inline-flex items-center gap-1 font-wds-sans text-[13px] leading-4 text-wds-text-secondary', MOTION, FOCUS_RING, onHover('text-wds-text-ink'))}
      >
        <Lock aria-hidden size={12} />
        Change
      </button>
      {open ? (
        <div
          ref={card}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className={cn(
            'absolute right-0 z-30 flex w-[300px] max-w-[calc(100vw-48px)] flex-col gap-1 border border-wds-border bg-wds-surface p-3 text-left shadow-wds-md',
            above ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <span id={`${id}-title`} className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">
            You can read this but not change it
          </span>
          <span id={`${id}-text`} className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {text}
          </span>
          <Link href={WHO_EDITS_HREF} className={cn('mt-1 font-wds-sans text-[12px] leading-4 text-wds-info-fg', FOCUS_RING, onHover('underline'))}>
            See the full table
          </Link>
        </div>
      ) : null}
    </span>
  );
}
