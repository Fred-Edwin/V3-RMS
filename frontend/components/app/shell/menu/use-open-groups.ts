'use client';

import * as React from 'react';

/**
 * Which sidebar groups are open (owner decision, 22 Oct 2026). The group of the page you are on is open and never closes by itself,
 * also on a blocked page or My file (the last group you were in stays open). Your own open or close is remembered on this device.
 */
const STORAGE_KEY = 'wendo.sidebar.groups';

export type HandChoices = Record<string, boolean>;

/** A group is open by your hand choice, else because it is the group of the page (or the last page that had one). */
export function isGroupOpen(key: string, hand: HandChoices, current: string): boolean {
  return hand[key] ?? key === current;
}

/** Arriving in a group clears an earlier hand-close of it: the group of the page is always open. */
export function arriveIn(hand: HandChoices, key: string): HandChoices {
  if (hand[key] !== false) return hand;
  const { [key]: _closed, ...rest } = hand;
  return rest;
}

function readHand(): HandChoices {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'));
  } catch {
    return {};
  }
}

function writeHand(hand: HandChoices): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hand));
  } catch {
    // Private window or blocked storage: the choice just is not remembered.
  }
}

export interface OpenGroups {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
}

/** `activeKey` is the group of the current page ('' when the page has none: the last group stays). */
export function useOpenGroups(activeKey: string): OpenGroups {
  const [hand, setHand] = React.useState<HandChoices>({});
  const [current, setCurrent] = React.useState(activeKey);

  // Read the device's choices after mount (server and first client render agree).
  React.useEffect(() => {
    setHand(readHand());
  }, []);

  React.useEffect(() => {
    if (!activeKey) return;
    setCurrent(activeKey);
    setHand((h) => {
      const next = arriveIn(h, activeKey);
      if (next !== h) writeHand(next);
      return next;
    });
  }, [activeKey]);

  const isOpen = React.useCallback((key: string): boolean => isGroupOpen(key, hand, current), [hand, current]);
  const toggle = React.useCallback(
    (key: string): void => {
      setHand((h) => {
        const next = { ...h, [key]: !isGroupOpen(key, h, current) };
        writeHand(next);
        return next;
      });
    },
    [current]
  );
  return { isOpen, toggle };
}
