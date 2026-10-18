'use client';

import * as React from 'react';

/** The green "what happened" line after a saved change. It fades after 8 seconds, as the file screen's does. */
export function useNotice(): { notice: string | null; announce: (message: string) => void } {
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [notice]);
  return { notice, announce: setNotice };
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-success-fg">
      {message}
    </p>
  );
}
