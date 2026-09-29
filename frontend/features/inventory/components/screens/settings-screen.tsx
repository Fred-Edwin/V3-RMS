'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { PermissionDeniedState } from '@/components/app/shell/shell-states';
import { SigningPinCard } from '@/components/app/shell/signing-pin-card';
import { Topbar } from '@/components/app/shell/topbar';
import { DesktopOnlyNotice } from '../desktop-only-notice';
import { TeamPanel } from '../team/team-panel';

/**
 * Store Manager Settings — the Team + My PIN slice of WALKTHROUGH §5.3b
 * (owner-approved 2026-09-23; Paper "Pre-Demo · Team & PIN" artboards 1–4).
 * Desktop-primary (O-SM1). STORE_MANAGER only — also enforced server-side on
 * every route this screen calls.
 */
type SettingsTab = 'team' | 'my-pin';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'team', label: 'Team' },
  { key: 'my-pin', label: 'My PIN' },
];

export function SettingsScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = React.useState<SettingsTab>('team');
  const openMyPin = React.useCallback(() => setTab('my-pin'), []);

  if (!hydrated) return null;
  if (!isDesktop) return <DesktopOnlyNotice screen="Settings" hint="Open Settings on a laptop to manage your team and signing PIN." />;

  if (role !== 'STORE_MANAGER') {
    return (
      <>
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Settings' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center px-8">
          <PermissionDeniedState description="Settings is for the Store Manager." />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'Settings' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Settings</h1>
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            Manage who can work in the Central Store, and your own signing PIN.
          </p>
        </div>

        <div role="tablist" aria-label="Settings sections" className="flex gap-6 border-b border-wds-border">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`settings-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`settings-panel-${key}`}
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px border-b-2 pb-2.5 font-wds-sans text-wds-body-sm outline-none transition-colors focus-visible:shadow-wds-ring',
                tab === key
                  ? 'border-wds-primary font-medium text-wds-text-ink'
                  : 'border-transparent text-wds-text-copy-muted hover:text-wds-text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
          {tab === 'team' ? <TeamPanel onOpenMyPin={openMyPin} /> : <SigningPinCard variant="settings" className="max-w-[560px]" />}
        </div>
      </div>
    </>
  );
}
