'use client';

import * as React from 'react';

import { Keypad } from '@/components/ui2/keypad';
import { cn } from '@/lib/cn';
import { useInAppPad, usePhoneKeyboardPreference } from '@/lib/pad-mode';

/**
 * The app's own number pad (Paper "Training fixes", T3 to T7). One pad per screen, shared by every number field on it: a field
 * (`QuantityField`, `PinField`) registers itself, tapping it opens the pad, and the pad types into whichever field is active.
 * The pad is a bottom sheet drawn by `NumberPadHost` (mounted once in the app shell). While it is open the shell shrinks by its
 * height (`--number-pad-h`), so the screen's own sticky action bar sits just above the keys and the field is never covered.
 *
 * Only a finger gets it (`lib/pad-mode.ts`); a mouse keeps ordinary typing. Real text never comes here.
 */

// --- Typing rules (pure, tested) ---------------------------------------------------------------------------------------------------------

export interface PadTyping {
  /** A decimal point is allowed (weight and volume). */
  decimal: boolean;
  /** The most characters the value may hold (a PIN is 4). */
  maxLength: number;
  /** The field was just opened: its whole value is selected, so the next key replaces it. */
  fresh: boolean;
  /** A code, not a quantity (PIN, account number): a leading 0 stays ("0123"). */
  keepZeros?: boolean;
}

/** The value after a key: a digit, or ".". Returns the same string when the key is not allowed. */
export function padInsert(current: string, key: string, { decimal, maxLength, fresh, keepZeros }: PadTyping): string {
  const base = fresh ? '' : current;
  if (key === '.') {
    if (!decimal || base.includes('.')) return current;
    return base === '' ? '0.' : `${base}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const next = base === '0' && !keepZeros ? key : `${base}${key}`;
  return next.length > maxLength ? current : next;
}

/** The value after the delete key: a fresh (selected) value clears whole, otherwise one character goes. */
export function padBackspace(current: string, fresh: boolean): string {
  return fresh ? '' : current.slice(0, -1);
}

// --- The one pad store ---------------------------------------------------------------------------------------------------------------------

export interface PadEntry {
  id: string;
  /** What the pad says it is typing into ("Baby marrow"). */
  label: string;
  unit?: string;
  decimal: boolean;
  maxLength: number;
  /** Show dots instead of digits (a PIN). */
  masked?: boolean;
  /** A code, not a quantity: a leading 0 stays. Always on for a masked PIN. */
  keepZeros?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** The key at the right: "Next" for a quantity, the caller's word for a PIN. */
  actionLabel?: string;
  /** Called when the last field is done, or a PIN is complete. */
  onDone?: (value: string) => void;
  element: () => HTMLElement | null;
}

interface PadState {
  activeId: string | null;
  fresh: boolean;
  hosts: number;
}

const entries = new Map<string, PadEntry>();
const listeners = new Set<() => void>();
let state: PadState = { activeId: null, fresh: false, hosts: 0 };

const emit = (): void => listeners.forEach((l) => l());
const set = (patch: Partial<PadState>): void => {
  state = { ...state, ...patch };
  emit();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = (): PadState => state;
// One frozen object: React compares server snapshots by identity and warns when each call returns a new one.
const SERVER_STATE: PadState = { activeId: null, fresh: false, hosts: 0 };
const serverSnapshot = (): PadState => SERVER_STATE;

/**
 * Scroll only when the box is hidden (under the pad or off the top). A box already in view stays put, so opening the pad never
 * nudges the page; the pad's own height is read from the shell variable it sets.
 */
function bringIntoView(el: HTMLElement | null): void {
  if (!el) return;
  const padHeight = Number.parseFloat(document.documentElement.style.getPropertyValue('--number-pad-h')) || 0;
  const rect = el.getBoundingClientRect();
  const visibleBottom = window.innerHeight - padHeight;
  if (rect.top >= 0 && rect.bottom <= visibleBottom) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export const numberPad = {
  /** A field tells the pad its latest value and callbacks (every render). */
  register(entry: PadEntry): void {
    entries.set(entry.id, entry);
    if (state.activeId === entry.id) emit();
  },
  unregister(id: string): void {
    entries.delete(id);
    if (state.activeId === id) set({ activeId: null });
  },
  open(id: string): void {
    if (!entries.has(id)) return;
    set({ activeId: id, fresh: true });
    // After the shell has shrunk to make room, bring the field into view above the pad.
    window.setTimeout(() => bringIntoView(entries.get(id)?.element() ?? null), 60);
  },
  /** Bring the open field into view, above the pad (called once the shell has shrunk to make room). */
  reveal(): void {
    const entry = state.activeId ? entries.get(state.activeId) : undefined;
    bringIntoView(entry?.element() ?? null);
  },
  close(): void {
    if (state.activeId === null) return;
    const el = entries.get(state.activeId)?.element();
    set({ activeId: null });
    // A field that checks itself when it loses focus (a count line) does so when the pad goes away.
    if (el && document.activeElement === el) el.blur();
  },
  press(key: string): void {
    const entry = state.activeId ? entries.get(state.activeId) : undefined;
    if (!entry) return;
    const next = padInsert(entry.value, key, { decimal: entry.decimal, maxLength: entry.maxLength, fresh: state.fresh, keepZeros: entry.keepZeros || entry.masked });
    if (state.fresh) state = { ...state, fresh: false };
    if (next !== entry.value) {
      entry.value = next;
      entry.onChange(next);
    }
    emit();
    if (entry.masked && next.length === entry.maxLength) {
      entry.onDone?.(next);
      numberPad.close();
    }
  },
  backspace(): void {
    const entry = state.activeId ? entries.get(state.activeId) : undefined;
    if (!entry) return;
    const next = padBackspace(entry.value, state.fresh);
    state = { ...state, fresh: false };
    entry.value = next;
    entry.onChange(next);
    emit();
  },
  /** Fields of the same kind on the page, in the order they appear. */
  order(): PadEntry[] {
    return Array.from(entries.values())
      .filter((e) => e.element())
      .sort((a, b) => {
        const left = a.element();
        const right = b.element();
        if (!left || !right) return 0;
        return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
  },
  /** The action key: on to the next field, or done after the last one. */
  next(): void {
    const entry = state.activeId ? entries.get(state.activeId) : undefined;
    if (!entry) return;
    const list = numberPad.order().filter((e) => !e.masked);
    const at = list.findIndex((e) => e.id === entry.id);
    const following = entry.masked ? undefined : list[at + 1];
    if (following) {
      numberPad.open(following.id);
      following.element()?.focus({ preventScroll: true });
      return;
    }
    numberPad.close();
    entry.onDone?.(entry.value);
  },
  mountHost(): () => void {
    set({ hosts: state.hosts + 1 });
    return () => set({ hosts: Math.max(0, state.hosts - 1) });
  },
  /** Test seam: forget everything. */
  reset(): void {
    entries.clear();
    state = { activeId: null, fresh: false, hosts: 0 };
    emit();
  },
};

export function usePadState(): PadState {
  return React.useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

// --- A field's side of it ------------------------------------------------------------------------------------------------------------------

export interface UseNumberPadFieldOptions {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  maxLength?: number;
  masked?: boolean;
  keepZeros?: boolean;
  actionLabel?: string;
  onDone?: (value: string) => void;
}

/**
 * What a number field needs from the pad. `inApp` is true on a finger, with the pad turned on and a host mounted: the field then
 * shows a read-only box that opens the pad (no phone keyboard). Otherwise it is an ordinary input.
 */
export function useNumberPadField(options: UseNumberPadFieldOptions) {
  const id = React.useId();
  const ref = React.useRef<HTMLElement | null>(null);
  const pad = usePadState();
  const wanted = useInAppPad();
  const inApp = wanted && pad.hosts > 0;
  const { label, unit, value, onChange, decimal = false, maxLength = 9, masked, keepZeros, actionLabel, onDone } = options;
  const latest = React.useRef({ onChange, onDone });
  latest.current = { onChange, onDone };

  React.useEffect(() => {
    if (!inApp) return;
    numberPad.register({
      id,
      label,
      unit,
      decimal,
      maxLength,
      masked,
      keepZeros,
      value,
      actionLabel,
      onChange: (v) => latest.current.onChange(v),
      onDone: (v) => latest.current.onDone?.(v),
      element: () => ref.current,
    });
  }, [inApp, id, label, unit, decimal, maxLength, masked, keepZeros, value, actionLabel]);
  React.useEffect(() => () => numberPad.unregister(id), [id]);

  const open = React.useCallback((): void => {
    if (inApp) numberPad.open(id);
  }, [inApp, id]);

  return { id, ref, inApp, active: inApp && pad.activeId === id, open };
}

/**
 * For a PIN box built on a library input (the four-box `InputOTP`): on a finger the box opens the pad instead of the phone keyboard.
 * Spread `inputProps` on the input and set `ref` to the library's input; `onDone` runs with the fourth digit.
 */
export function usePinPad({ value, onChange, onDone, label = 'PIN', actionLabel = 'Sign' }: { value: string; onChange: (value: string) => void; onDone?: (pin: string) => void; label?: string; actionLabel?: string }) {
  const pad = useNumberPadField({ label, value, onChange, masked: true, maxLength: 4, actionLabel, onDone });
  return {
    ref: pad.ref,
    inApp: pad.inApp,
    open: pad.open,
    inputProps: { inputMode: (pad.inApp ? 'none' : 'numeric') as 'none' | 'numeric', onFocus: pad.open, onClick: pad.open },
  };
}

// --- The pad itself --------------------------------------------------------------------------------------------------------------------------

/** Mounted once, in the app shell. Draws the active field's pad at the bottom and tells the shell how tall it is. */
export function NumberPadHost() {
  const pad = usePadState();
  const [prefer, setPrefer] = usePhoneKeyboardPreference();
  const boxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => numberPad.mountHost(), []);

  const entry = pad.activeId ? numberPad.order().find((e) => e.id === pad.activeId) : undefined;
  const open = Boolean(entry);

  // Keep the shell's height in step with the pad, so the screen's own bottom bar rests on top of the keys.
  React.useEffect(() => {
    const root = document.documentElement;
    const box = boxRef.current;
    if (!open || !box) {
      root.style.removeProperty('--number-pad-h');
      return;
    }
    const apply = (): void => root.style.setProperty('--number-pad-h', `${box.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    const reveal = window.setTimeout(() => numberPad.reveal(), 120);
    return () => {
      window.clearTimeout(reveal);
      observer.disconnect();
      root.style.removeProperty('--number-pad-h');
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') numberPad.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!entry) return null;
  const shown = entry.masked ? '•'.repeat(entry.value.length) : entry.value === '' ? '0' : entry.value;
  const list = numberPad.order().filter((e) => !e.masked);
  const isLast = entry.masked || list[list.length - 1]?.id === entry.id;
  const label = entry.actionLabel ?? (isLast ? 'Done' : 'Next');

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={`Number pad for ${entry.label}`}
      // A key press must not take focus from the field, or the field would think it was left (a count line checks itself on blur).
      onMouseDown={(e) => e.preventDefault()}
      // Above a sheet or dialog (a PIN sheet) and clickable inside one: a modal layer switches off pointer events outside itself and
      // treats a press outside as "dismiss", neither of which may happen to the keys.
      onPointerDown={(e) => e.stopPropagation()}
      style={{ pointerEvents: 'auto' }}
      className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-w-[480px] flex-col border-t border-wds-border-strong bg-wds-neutral-100 print:hidden">
      <div className="flex items-center justify-between gap-3 px-3 pt-2">
        <p className="min-w-0 truncate font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {entry.label}
          <span className="ml-2 font-wds-mono text-[14px] text-wds-text-ink">{shown}</span>
          {entry.unit && !entry.masked ? <span className="ml-1 font-wds-mono text-[12px]">{entry.unit}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => {
            setPrefer(!prefer);
            numberPad.close();
          }}
          className="shrink-0 py-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary underline underline-offset-2 outline-none focus-visible:shadow-wds-ring"
        >
          Use the phone keyboard
        </button>
      </div>
      <Keypad
        className={cn('border-t-0 pt-2')}
        showDecimal={entry.decimal}
        onDigit={(d) => numberPad.press(d)}
        onBackspace={() => numberPad.backspace()}
        action={{ label, detail: entry.masked ? undefined : `${shown}${entry.unit ? ` ${entry.unit}` : ''}`, tone: 'primary', onPress: () => numberPad.next(), disabled: entry.masked ? entry.value.length < entry.maxLength : false }}
      />
    </div>
  );
}
