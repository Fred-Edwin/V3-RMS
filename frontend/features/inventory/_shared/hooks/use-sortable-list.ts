'use client';

import * as React from 'react';

/**
 * Drag-to-reorder with a keyboard alternative, for the Attendant's "Reorder for today" and Count setup's section and item lists.
 * Drag is never the only way: the handle is a button; focused, ArrowUp and ArrowDown move the row by one place (Home and End to
 * the ends) and the move is announced through `announcement` (render it in an `aria-live` region). The parent owns the order:
 * `onChange` receives the new array. Pointer dragging uses pointer capture on the handle (touch scrolls normally elsewhere on the
 * row; `touch-action: none` is on the handle only), and moves the row as the pointer crosses the next row's middle.
 */
export interface SortableList<T> {
  /** Spread on the row element. */
  rowRef: (id: string) => (el: HTMLElement | null) => void;
  /** Spread on the handle button. */
  handleProps: (id: string, label: string) => React.ButtonHTMLAttributes<HTMLButtonElement> & { 'data-sortable-handle': string; 'data-dragging': boolean };
  draggingId: string | null;
  /** "Others moved to position 1 of 4", for a polite live region. */
  announcement: string;
  /** Move an item programmatically (a "Move up" menu item, for example). */
  move: (id: string, toIndex: number) => void;
  items: T[];
}

export function useSortableList<T>(items: T[], getId: (item: T) => string, getName: (item: T) => string, onChange: (next: T[]) => void): SortableList<T> {
  const rows = React.useRef(new Map<string, HTMLElement>());
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const focusAfter = React.useRef<string | null>(null);
  const itemsRef = React.useRef(items);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    itemsRef.current = items;
    onChangeRef.current = onChange;
  });

  const move = React.useCallback(
    (id: string, toIndex: number): void => {
      const list = itemsRef.current;
      const from = list.findIndex((i) => getId(i) === id);
      const to = Math.max(0, Math.min(list.length - 1, toIndex));
      if (from < 0 || from === to) return;
      const next = list.slice();
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return;
      next.splice(to, 0, moved);
      itemsRef.current = next;
      onChangeRef.current(next);
      setAnnouncement(`${getName(moved)} moved to position ${to + 1} of ${next.length}`);
    },
    [getId, getName],
  );

  // A keyboard move re-keys the row; give the handle its focus back once the new order is drawn.
  React.useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    rows.current.get(id)?.querySelector<HTMLButtonElement>('[data-sortable-handle]')?.focus();
  });

  const rowRef = React.useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) rows.current.set(id, el);
      else rows.current.delete(id);
    },
    [],
  );

  const handleProps = (id: string, label: string) => ({
    'data-sortable-handle': id,
    'data-dragging': draggingId === id,
    type: 'button' as const,
    'aria-label': `${label}. Press the up or down arrow to move it.`,
    style: { touchAction: 'none' } as React.CSSProperties,
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const list = itemsRef.current;
      const index = list.findIndex((i) => getId(i) === id);
      const target = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : null;
      if (target === null) return;
      event.preventDefault();
      focusAfter.current = id;
      move(id, target);
    },
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggingId(id);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (draggingId !== id) return;
      // The dragged row belongs after every other row whose middle line is above the pointer.
      const list = itemsRef.current;
      const from = list.findIndex((i) => getId(i) === id);
      let target = 0;
      for (const item of list) {
        if (getId(item) === id) continue;
        const rect = rows.current.get(getId(item))?.getBoundingClientRect();
        if (rect && event.clientY > rect.top + rect.height / 2) target += 1;
      }
      if (target !== from) move(id, target);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setDraggingId(null);
    },
    onPointerCancel: () => setDraggingId(null),
  });

  return { rowRef, handleProps, draggingId, announcement, move, items };
}
