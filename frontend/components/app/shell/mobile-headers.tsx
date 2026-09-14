import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Mobile Hub Header + Mobile Task Header — cross-feature shared, not
 * Inventory-specific. Reference: Milestone One mobile artboards, Paper page
 * `B-0`, node `TM8-0` (hub header, "1m · Item catalog · mobile · populated")
 * and `TUY-0` / `TZO-0` (task header, "2m · New item" / "5m · Par levels").
 *
 * Both always render on the dark `--wds-sidebar-mid` ground — Wendo's mobile
 * headers never appear on a light background, so there is no light variant.
 */

/* ------------------------------------------------------------ Hub Header */

export interface MobileHubHeaderProps {
  title: string;
  subtitle: string;
  userInitials: string;
  orgLabel?: string;
  onMenuClick?: () => void;
  className?: string;
}

/**
 * Hamburger + "Wendo RMS · <org>" + avatar, then a title/subtitle pair.
 * Reference: `TM8-0`.
 */
export function MobileHubHeader({
  title,
  subtitle,
  userInitials,
  orgLabel = 'Hub',
  onMenuClick,
  className,
}: MobileHubHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-wds-4 bg-wds-sidebar-mid px-wds-4 pb-wds-5 pt-wds-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-wds-2.5">
          <button type="button" onClick={onMenuClick} aria-label="Open menu" className="flex shrink-0">
            <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0">
              <path
                d="M1 1H17M1 7H17M1 13H17"
                fill="none"
                stroke="var(--wds-sidebar-fg-item)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-caramel">
            Wendo RMS &middot; {orgLabel}
          </span>
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wds-espresso-600 font-wds-sans text-wds-caption text-white">
          {userInitials}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <h1 className="font-wds-sans text-wds-mobile-title text-wds-sidebar-fg-active">{title}</h1>
        <p className="font-wds-sans text-wds-caption text-wds-sidebar-fg-item">{subtitle}</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Task Header */

export interface MobileTaskHeaderProps {
  title: string;
  subtitle: string;
  /** "Cancel" (create/edit forms, back to previous screen) or "Done" (save-as-you-go screens like Restock Levels). */
  trailingAction: 'Cancel' | 'Done';
  onBack?: () => void;
  onTrailingAction?: () => void;
  className?: string;
}

/**
 * Back chevron + Cancel/Done, then a title/subtitle pair. Used by every
 * mobile full-screen task (New item, Manage categories, New/edit supplier,
 * Restock levels). Reference: `TUY-0` (Cancel) / `TZO-0` (Done).
 */
export function MobileTaskHeader({
  title,
  subtitle,
  trailingAction,
  onBack,
  onTrailingAction,
  className,
}: MobileTaskHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-wds-1.5 bg-wds-sidebar-mid px-wds-4 pb-wds-4.5 pt-wds-3', className)}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} aria-label="Back" className="flex shrink-0">
          <svg width="9" height="16" viewBox="0 0 9 16" className="shrink-0">
            <path
              d="M8 1L1 8L8 15"
              fill="none"
              stroke="var(--wds-sidebar-fg-active)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onTrailingAction}
          className="font-wds-sans text-wds-body text-wds-caramel"
        >
          {trailingAction}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        <h1 className="font-wds-sans text-wds-mobile-task-title text-wds-sidebar-fg-active">{title}</h1>
        <p className="font-wds-sans text-wds-caption text-wds-sidebar-fg-item">{subtitle}</p>
      </div>
    </div>
  );
}
