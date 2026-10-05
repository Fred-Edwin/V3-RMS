'use client';

import * as React from 'react';
import { Eye, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui2/button';
import { useAuthStore } from '@/store/authStore';
import { DEMO_ROLES, DEMO_ROLE_LABELS, useDemoViewStore, type DemoRole } from '../../_shared/hooks/use-demo-view';
import { SCENARIOS } from '../mock/scenarios';
import { mockStore } from '../mock/store';

const selectClass =
  'h-7 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-2 font-wds-sans text-wds-caption text-wds-text focus-visible:outline-none focus-visible:shadow-wds-ring';

/**
 * Demo bar: System Admin only. Switches which role the mock screens act as, jumps to a scenario, and resets the data. It
 * never logs in as anyone; the real session stays the System Admin's. Not a product screen and not in Paper.
 */
export function DemoBar() {
  const realRole = useAuthStore((s) => s.user?.role);
  const viewAs = useDemoViewStore((s) => s.viewAs);
  const hydrate = useDemoViewStore((s) => s.hydrate);
  const setViewAs = useDemoViewStore((s) => s.setViewAs);
  const [scenario, setScenario] = React.useState('default');
  // On a phone the bar would cover the screen's own buttons, so it starts folded to a small "Demo" tab there.
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => hydrate(), [hydrate]);
  React.useEffect(() => {
    if (window.matchMedia('(max-width: 640px)').matches) setOpen(false);
  }, []);

  if (realRole !== 'SYSTEM_ADMIN') return null;
  const current: DemoRole = viewAs ?? 'SYSTEM_ADMIN';
  const phone = current === 'STORE_ATTENDANT';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open demo controls"
        className="fixed bottom-24 right-3 z-40 flex items-center gap-1.5 rounded-wds-md border border-wds-neutral-800 bg-wds-neutral-950 px-3 py-2 font-wds-sans text-wds-caption font-semibold uppercase tracking-wider text-wds-caramel-500 shadow-wds-drawer"
      >
        <Eye className="size-3.5" aria-hidden /> Demo
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Demo controls"
      className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-2 rounded-wds-md border border-wds-neutral-800 bg-wds-neutral-950 px-4 py-2 font-wds-sans text-wds-caption text-wds-neutral-100 shadow-wds-drawer"
    >
      <button type="button" onClick={() => setOpen(false)} aria-label="Fold demo controls" className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-wds-caramel-500">
        <Eye className="size-3.5" aria-hidden /> Demo
      </button>
      <label className="flex items-center gap-2">
        <span>View as</span>
        <select className={selectClass} value={current} onChange={(e) => setViewAs(e.target.value as DemoRole)} aria-label="View as role">
          {DEMO_ROLES.map((r) => (
            <option key={r} value={r}>
              {DEMO_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      {phone ? <span className="text-wds-neutral-400">phone layout</span> : null}
      <label className="flex items-center gap-2">
        <span>Scenario</span>
        <select className={selectClass} value={scenario} onChange={(e) => setScenario(e.target.value)} aria-label="Scenario">
          {SCENARIOS.map((s) => (
            <option key={s.key} value={s.key} title={s.description}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" variant="secondary" onClick={() => mockStore().reset(scenario)}>
        <RotateCcw /> Load
      </Button>
    </div>
  );
}
