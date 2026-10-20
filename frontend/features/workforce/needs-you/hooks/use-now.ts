'use client';

import { useEffect, useState } from 'react';

/** The current moment, refreshed each minute, so "Today 09:02" and the red after 3 days stay right on a screen left open. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
