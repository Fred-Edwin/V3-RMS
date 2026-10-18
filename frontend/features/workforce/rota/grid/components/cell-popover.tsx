'use client';

import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, SHIFT_PAINT, onHover } from '../../../_shared';
import { hoursUnit, timeRangeMono, toneOfColour } from '../../_shared/lib/shift-look';
import type { TemplateView } from '../../_shared/types/rota-types';

/**
 * The shift picker under a clicked cell (Paper step 2): the shifts this person may work, "Day off", and a footer that points at Shift
 * templates. One click picks and saves; Escape or a click outside closes and gives focus back. Letters pick a shift and Delete picks
 * a day off, the same keys the grid itself answers to. Placed beside the cell and kept inside the window.
 */
const WIDTH = 316;

export function CellPopover({
  opener,
  title,
  subtitle,
  options,
  currentIds,
  onPick,
  onClose,
  editShiftsHref,
}: {
  opener: HTMLElement;
  title: string;
  subtitle: string;
  options: readonly TemplateView[];
  currentIds: readonly string[];
  /** A template id, or null for a day off. */
  onPick: (templateId: string | null) => void;
  onClose: () => void;
  /** Present only for someone who may edit shifts. */
  editShiftsHref?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [place, setPlace] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    const box = opener.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 320;
    const left = Math.max(8, Math.min(box.left, window.innerWidth - WIDTH - 8));
    const below = box.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, box.top - height - 6) : below;
    setPlace({ left, top });
  }, [opener]);

  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-option]')?.focus();
    const away = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node) && !opener.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [opener, onClose]);

  const close = (): void => {
    onClose();
    opener.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-option]') ?? []);
      const at = items.indexOf(document.activeElement as HTMLElement);
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onPick(null);
      return;
    }
    const match = options.find((t) => t.letter && t.letter.toLowerCase() === e.key.toLowerCase());
    if (match && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      onPick(match.id);
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${title}, ${subtitle}`}
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', width: WIDTH, left: place?.left ?? -9999, top: place?.top ?? -9999 }}
      className="z-40 flex flex-col border border-wds-border bg-wds-surface shadow-[0_18px_44px_color-mix(in_oklab,var(--wds-neutral-950)_28%,transparent)]"
    >
      <div className="flex items-start justify-between border-b border-wds-border px-3.5 pb-2.5 pt-3">
        <div className="flex flex-col">
          <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{title}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{subtitle}</span>
        </div>
        <button type="button" aria-label="Close" onClick={close} className={cn('-mr-1.5 -mt-0.5 flex h-8 w-8 items-center justify-center text-[18px] text-wds-text-muted', MOTION, FOCUS_RING, onHover('text-wds-text-ink'))}>
          <span aria-hidden>×</span>
        </button>
      </div>
      <div role="listbox" aria-label="Shifts" className="flex flex-col gap-2 p-3">
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={currentIds.includes(t.id)}
            data-option
            onClick={() => onPick(t.id)}
            className={cn('flex h-9 items-center justify-between gap-3 border px-3 text-left', SHIFT_PAINT[toneOfColour(t.colour)].chip, MOTION, FOCUS_RING, onHover('brightness-[0.97]'), currentIds.includes(t.id) && 'border-wds-primary')}
          >
            <span className="font-wds-sans text-[13px] leading-4">{t.name}</span>
            <span className="font-wds-mono text-[11px] leading-[14px]">
              {timeRangeMono(t)} · {hoursUnit(t.paidMinutes)}
              {t.letter ? ` · ${t.letter}` : ''}
            </span>
          </button>
        ))}
        <button
          type="button"
          role="option"
          aria-selected={currentIds.length === 0}
          data-option
          onClick={() => onPick(null)}
          className={cn('flex h-9 items-center justify-between border border-wds-border-strong px-3 text-left', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}
        >
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">Day off</span>
          <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">Delete</span>
        </button>
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-wds-border bg-wds-neutral-50 px-3.5 py-2.5">
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Pick a shift as a brush and drag across a row to fill a week.</span>
        {editShiftsHref ? (
          <Link href={editShiftsHref} className={cn('shrink-0 font-wds-sans text-[12px] font-medium leading-4 text-wds-primary', FOCUS_RING)}>
            Edit shifts →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
