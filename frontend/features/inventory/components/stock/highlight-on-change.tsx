'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Flashes a soft espresso wash behind a number when it changes after a
 * mutation (§4.2 "Mutations — KPI/number changes flash"). Same treatment as
 * the Requisitions approval screen's local helper; this is the inventory
 * feature's shared copy for the stock screens. Never flashes on first
 * render, only on a change; the wash is colour only (no motion), so it is
 * safe under prefers-reduced-motion.
 */
export function HighlightOnChange({ value, className, children }: { value: string | number; className?: string; children?: React.ReactNode }) {
  const [flashing, setFlashing] = React.useState(false);
  const previous = React.useRef(value);

  React.useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 900);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className={cn('-mx-0.5 rounded-wds-sm px-0.5 transition-colors duration-500', flashing && 'bg-wds-espresso-100', className)}>
      {children ?? value}
    </span>
  );
}
