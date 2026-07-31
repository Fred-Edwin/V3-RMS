'use client';

import { cn } from '@/lib/cn';

export type PrepTab = 'log' | 'recipes' | 'history';

interface PrepTabsProps {
  active: PrepTab;
  onChange: (tab: PrepTab) => void;
  className?: string;
}

/**
 * Manager-only top tabs for Prep Entry — Log Prep / Prep Recipes / Prep
 * History. Kept out of the sidebar per the owner's explicit ask (avoid
 * sidebar clutter); Attendants never render this at all (Log Prep only),
 * matching how recipe-authoring and history are Manager-only everywhere
 * else in Inventory.
 */
export function PrepTabs({ active, onChange, className }: PrepTabsProps) {
  const tabs: { key: PrepTab; label: string }[] = [
    { key: 'log', label: 'Log Prep' },
    { key: 'recipes', label: 'Prep Recipes' },
    { key: 'history', label: 'Prep History' },
  ];

  return (
    <div className={cn('flex gap-1 border-b border-stone-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative px-4 py-2.5 text-label-md font-medium transition-colors',
            active === tab.key ? 'text-espresso' : 'text-stone-500 hover:text-stone-700',
          )}
        >
          {tab.label}
          {active === tab.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-espresso" />}
        </button>
      ))}
    </div>
  );
}
