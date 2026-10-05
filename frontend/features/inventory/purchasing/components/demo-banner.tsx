import { FlaskConical } from 'lucide-react';

/** Shown on every mock Purchasing screen: this data lives in the browser and nothing here touches the real system. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="flex shrink-0 items-center gap-2 border-b border-wds-warning-border bg-wds-warning-bg px-8 py-1.5 font-wds-sans text-wds-caption text-wds-warning-fg"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">Demo data.</span> This flow is not live yet: orders you make here stay in this browser and change no stock or money.
      </span>
    </div>
  );
}
