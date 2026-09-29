import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback } from '@/components/ui2/avatar';
import { HintTooltip } from './hint-tooltip';
import { SignOutIcon } from './nav-icons';
import type { NavIcon } from './nav-icons';

/**
 * Hub Sidebar Nav — the desktop nav rail + mobile icon rail shared by every
 * role/feature (not Inventory-specific). Reference: Session-0 shell, Paper
 * page `3-0`, node `18O-0` (desktop "Store role" specimen) / `1A5-0` (mobile
 * "Department Head" rail).
 *
 * Role-conditional: the rail is one component, the group/item set passed in
 * is what changes per role/org (see Paper's own sidebar notes, `1AK-0`).
 *
 * Active-state note (verified against the actual drawn nodes, not just
 * Paper's summary copy, which says "same active treatment" for mobile — the
 * two specimens are NOT the same):
 * - Desktop: no fill, no left marker. Active label goes brighter
 *   (`--wds-sidebar-fg-active`) with a 1.5px caramel underline; the icon also
 *   takes caramel.
 * - Mobile rail: left-border marker (2px caramel) + a subtle white-wash
 *   active background (`--wds-sidebar-active-bg`), icon strokes go to
 *   `--wds-sidebar-fg-active`.
 */

export interface SidebarNavSubItem {
  key: string;
  label: string;
  href: string;
  /** Drawn but not usable yet — rendered as-is with `aria-disabled` and this hint as a tooltip. */
  disabledHint?: string;
}

export interface SidebarNavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  count?: number;
  /** Sub-pages, shown as the curved connector rail under the item while it is active (`1BI5-0`). */
  subItems?: SidebarNavSubItem[];
}

export interface SidebarNavGroup {
  key: string;
  label: string;
  items: SidebarNavItem[];
}

export interface SidebarNavUser {
  name: string;
  role: string;
  initials: string;
}

export interface SidebarNavProps {
  groups: SidebarNavGroup[];
  activeKey: string;
  /** Active sub-link key under the active item, when it has `subItems`. */
  activeSubKey?: string;
  user: SidebarNavUser;
  orgLabel?: string;
  logoSrc?: string;
  onNavigate?: (item: SidebarNavItem, event: React.MouseEvent<HTMLAnchorElement>) => void;
  onSignOut?: () => void;
  className?: string;
}

/**
 * Hover/focus-visible/active-press states — Paper never draws these (it only
 * draws default and active), so they're convention-derived per
 * 04-components.md's "Convention-derived states" rule: a subtle background
 * tint on hover (consistent with the mobile rail's `active-bg` wash), a
 * visible focus ring for keyboard nav, and a darker tint on press.
 */
const navItemInteractiveClass =
  'rounded-wds-sm outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring active:bg-wds-sidebar-active-bg/80';

function DesktopNavItem({
  item,
  active,
  onNavigate,
}: {
  item: SidebarNavItem;
  active: boolean;
  onNavigate?: (item: SidebarNavItem, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate ? (e) => onNavigate(item, e) : undefined}
      className={cn('flex h-8 shrink-0 items-center gap-wds-2.5 px-wds-2.5', navItemInteractiveClass)}
    >
      <Icon
        className={cn('shrink-0', active ? 'text-wds-caramel' : 'text-wds-sidebar-fg-muted')}
      />
      {active ? (
        <span className="inline-block border-b-[1.5px] border-wds-caramel pb-0.5">
          <span className="font-wds-sans text-wds-label font-medium text-wds-sidebar-fg-active">
            {item.label}
          </span>
        </span>
      ) : (
        <span className="grow font-wds-sans text-wds-body-sm text-wds-sidebar-fg-item">
          {item.label}
        </span>
      )}
      {item.count != null ? (
        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-wds-sm bg-wds-sidebar-badge-bg px-[5px]">
          <span className="font-wds-mono text-wds-mono-sm font-semibold text-wds-sidebar-badge-fg">
            {item.count}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

const SUB_ROW_HEIGHT = 26;

/**
 * Sub-link rail — Paper `1BI5-0` inside `1AYX-0` (memory: sidebar sub-link
 * pattern). One SVG draws the connector down the left edge and curves
 * (radius ~8px) into the last row; every other row gets a short 32%-opacity
 * tick. Active sub-link: white, medium. Inactive: caramel-300 at 85%.
 * No motion on the rail itself — it's navigation seen dozens of times a day.
 */
function SubLinkRail({
  items,
  activeSubKey,
  onNavigate,
}: {
  items: SidebarNavSubItem[];
  activeSubKey?: string;
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const height = items.length * SUB_ROW_HEIGHT;
  const curveY = height - 13;
  return (
    <div className="relative -mt-[5px] mb-2 ml-[27px] flex flex-col">
      <svg
        width="20"
        height={height}
        viewBox={`0 0 20 ${height}`}
        className="pointer-events-none absolute left-[11px] top-0"
        aria-hidden
      >
        <path
          d={`M 1 0 L 1 ${curveY - 8} Q 1 ${curveY} 9 ${curveY} L 20 ${curveY}`}
          fill="none"
          stroke="var(--wds-caramel-500)"
        />
      </svg>
      {items.map((item, i) => {
        const active = item.key === activeSubKey;
        const isLast = i === items.length - 1;
        const label = (
          <span
            className={cn(
              'ml-[34px] font-wds-sans text-wds-body-sm leading-4',
              active ? 'font-medium text-wds-surface' : 'text-wds-caramel-300 opacity-85',
            )}
          >
            {item.label}
          </span>
        );
        const tick = isLast ? null : (
          <span className="pointer-events-none absolute left-3 top-[13px] h-px w-3.5 bg-wds-caramel-500 opacity-[0.32]" aria-hidden />
        );
        const rowClass = 'relative flex h-[26px] shrink-0 items-center rounded-wds-sm outline-none';
        if (item.disabledHint) {
          return (
            <HintTooltip key={item.key} hint={item.disabledHint} side="top" className="flex">
              {(describedBy) => (
                <span
                  role="link"
                  tabIndex={0}
                  aria-disabled="true"
                  aria-describedby={describedBy}
                  className={cn(rowClass, 'w-full cursor-not-allowed focus-visible:shadow-wds-ring')}
                >
                  {tick}
                  {label}
                </span>
              )}
            </HintTooltip>
          );
        }
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate ? (e) => onNavigate(item.href, e) : undefined}
            className={cn(
              rowClass,
              'transition-[background-color] duration-150 hover:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring [&:hover>span:last-child]:opacity-100',
            )}
          >
            {tick}
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function SidebarNav({
  groups,
  activeKey,
  activeSubKey,
  user,
  orgLabel = 'HUB',
  logoSrc,
  onNavigate,
  onSignOut,
  className,
}: SidebarNavProps) {
  return (
    <nav
      className={cn(
        'flex h-full w-[236px] shrink-0 flex-col bg-wds-gradient-sidebar font-wds-sans text-wds-caption',
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-wds-2.5 border-b border-[#38302A] px-wds-4.5">
        <div
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-cover bg-center shadow-[0_1px_0_0_rgb(255_255_255/0.10)_inset]"
          style={logoSrc ? { backgroundImage: `url(${logoSrc})` } : { backgroundColor: 'var(--wds-espresso-600)' }}
        />
        <span className="font-wds-sans text-wds-body-sm font-semibold tracking-tight text-wds-sidebar-fg-active">
          Wendo RMS
        </span>
        <span className="ml-auto font-wds-mono text-wds-overline text-wds-sidebar-fg-muted">
          {orgLabel}
        </span>
      </div>

      <div className="flex flex-col gap-px overflow-y-auto overflow-x-hidden px-wds-2.5 py-wds-3.5">
        {groups.map((group, i) => (
          <React.Fragment key={group.key}>
            <div className={cn('px-wds-2.5 pb-1.5', i === 0 ? 'pt-2' : 'pt-4')}>
              <span className="font-wds-mono text-wds-overline text-wds-sidebar-fg-muted">
                {group.label}
              </span>
            </div>
            {group.items.map((item) => (
              <React.Fragment key={item.key}>
                <DesktopNavItem item={item} active={item.key === activeKey} onNavigate={onNavigate} />
                {item.key === activeKey && item.subItems?.length ? (
                  <SubLinkRail
                    items={item.subItems}
                    activeSubKey={activeSubKey}
                    onNavigate={onNavigate ? (href, e) => onNavigate({ ...item, href }, e) : undefined}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-auto flex h-[52px] shrink-0 items-center gap-wds-2.5 border-t border-[#38302A] px-wds-4.5">
        <Avatar>
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate font-wds-sans text-wds-caption font-medium text-wds-sidebar-fg-name">
            {user.name}
          </span>
          <span className="font-wds-sans text-wds-overline font-normal normal-case tracking-normal text-wds-sidebar-fg-muted">
            {user.role}
          </span>
        </div>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-wds-sm text-wds-sidebar-fg-muted outline-none transition-colors hover:bg-wds-sidebar-active-bg hover:text-wds-sidebar-fg-active focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring"
          >
            <SignOutIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
    </nav>
  );
}

export interface SidebarRailProps {
  groups: SidebarNavGroup[];
  activeKey: string;
  user: Pick<SidebarNavUser, 'initials'>;
  logoSrc?: string;
  onNavigate?: (item: SidebarNavItem, event: React.MouseEvent<HTMLAnchorElement>) => void;
  onSignOut?: () => void;
  className?: string;
}

/**
 * Mobile icon rail — flat items across all groups (no group labels, no "More"
 * menu, ever). Reference: `1A5-0`.
 */
export function SidebarRail({ groups, activeKey, user, logoSrc, onNavigate, onSignOut, className }: SidebarRailProps) {
  const items = groups.flatMap((g) => g.items);
  return (
    <nav className={cn('flex h-full w-[60px] shrink-0 flex-col items-center bg-wds-gradient-sidebar py-wds-4', className)}>
      <div
        className="mb-wds-4 h-[22px] w-[22px] shrink-0 rounded-full bg-cover bg-center shadow-[0_1px_0_0_rgb(255_255_255/0.10)_inset]"
        style={logoSrc ? { backgroundImage: `url(${logoSrc})` } : { backgroundColor: 'var(--wds-espresso-600)' }}
      />
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate ? (e) => onNavigate(item, e) : undefined}
            className={cn(
              'relative flex size-10 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring',
              active && 'border-l-2 border-wds-caramel bg-wds-sidebar-active-bg'
            )}
          >
            <Icon className={active ? 'text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-muted'} />
            {item.count != null ? (
              <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-wds-sm bg-wds-sidebar-badge-bg">
                <span className="font-wds-mono text-[9px]/3 font-semibold text-wds-sidebar-badge-fg">
                  {item.count}
                </span>
              </span>
            ) : null}
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col items-center gap-wds-2.5">
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-8 shrink-0 items-center justify-center rounded-wds-sm text-wds-sidebar-fg-muted outline-none transition-colors hover:bg-wds-sidebar-active-bg hover:text-wds-sidebar-fg-active focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring"
          >
            <SignOutIcon className="size-3.5" />
          </button>
        ) : null}
        <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-wds-avatar-bg">
          <span className="font-wds-mono text-[10px]/3 text-wds-avatar-fg">{user.initials}</span>
        </div>
      </div>
    </nav>
  );
}
