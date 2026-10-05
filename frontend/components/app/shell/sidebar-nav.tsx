import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback } from '@/components/ui2/avatar';
import { HintTooltip } from './hint-tooltip';
import { SignOutIcon } from './nav-icons';
import type { NavIcon } from './nav-icons';

/**
 * Hub Sidebar Nav — the desktop nav and mobile icon rail shared by every role/feature (not Inventory-specific).
 *
 * Desktop is the GEOMETRIC sidebar (owner-approved 4 Oct 2026), copied from the Workforce master, Paper page "Workforce · A.
 * The people", frame `OQP-0` (values read with get_jsx): collapsible groups with a mono label and chevron; under each, a
 * straight caramel rail with a square node and a short tick per item; the active item sits on a faint caramel wash with a
 * 2px caramel bar on the sidebar's left edge and a filled node; counts are small espresso chips. The master draws no
 * sub-links, so an item's sub-links (Stock & counts) are an extension: a thinner nested rail with ticks and no nodes.
 *
 * Role-conditional: this is one component; the groups and items passed in are what change per role.
 * The mobile icon rail below is unchanged (Paper `1A5-0`): left-border marker plus a white wash on the active item.
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
  /** Sub-pages, shown as a nested rail under the item: open while the item is active, and opened or closed with its chevron. */
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

/** Chevron from the master: points down when open, right when shut. */
function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={cn('shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none', !open && '-rotate-90', className)}
    >
      <path d="M1.5 3 5 6.5 8.5 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

const OPEN_STORAGE_KEY = 'sidebar-nav-open';

const without = (record: Record<string, boolean>, key: string): Record<string, boolean> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

function remember(record: Record<string, boolean>): void {
  try {
    sessionStorage.setItem(OPEN_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private windows and blocked storage: the choice just lasts until the page reloads.
  }
}

const groupStateKey = (groupKey: string): string => `group:${groupKey}`;

/**
 * Which groups and parent items are open. A group is open by default; a parent item is open while you are in it. The
 * chevron closes or opens either, and the choice is remembered for the session. Moving into a section opens it (and its
 * group) again, whatever was chosen before.
 */
function useExpandedItems(activeKey: string, activeGroupKey: string | undefined) {
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const activeKeys = React.useMemo(() => [activeKey, ...(activeGroupKey ? [groupStateKey(activeGroupKey)] : [])], [activeKey, activeGroupKey]);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(OPEN_STORAGE_KEY);
      if (raw) setOverrides(activeKeys.reduce((rest, key) => without(rest, key), JSON.parse(raw) as Record<string, boolean>));
    } catch {
      // Nothing remembered, or storage is blocked: start from the default.
    }
    // Read once on mount; later changes of the active item are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setOverrides((prev) => {
      if (!activeKeys.some((key) => key in prev)) return prev;
      const next = activeKeys.reduce((rest, key) => without(rest, key), prev);
      remember(next);
      return next;
    });
  }, [activeKeys]);

  const isExpanded = React.useCallback((key: string, defaultOpen: boolean): boolean => overrides[key] ?? defaultOpen, [overrides]);
  const toggle = React.useCallback((key: string, defaultOpen: boolean): void => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? defaultOpen) };
      remember(next);
      return next;
    });
  }, []);
  return { isExpanded, toggle };
}

/** The group label, which is also the button that opens and closes the whole group (`OQW-0`: h-6, 11px mono, 0.06em). */
function GroupHeader({ label, expanded, controlsId, onToggle, className }: { label: string; expanded: boolean; controlsId: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      className={cn(
        'flex h-6 w-full shrink-0 items-center rounded-wds-sm pl-wds-2.5 pr-1.5 text-left outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring',
        className
      )}
    >
      <span className="grow font-wds-mono text-wds-overline font-semibold tracking-[0.06em] text-wds-sidebar-fg-muted">{label}</span>
      <span className="flex size-4 shrink-0 items-center justify-center text-wds-sidebar-fg-muted">
        <Chevron open={expanded} />
      </span>
    </button>
  );
}

/** The rail for one item (`OR1-0`): the vertical line, a square node and a tick into the item; the last item's line stops at its node. */
function RailSvg({ first, last, active }: { first: boolean; last: boolean; active: boolean }) {
  const nodeY = first ? 20.5 : 14.5;
  const tickY = first ? 22.5 : 16.5;
  return (
    <svg width="24" height="100%" aria-hidden className="pointer-events-none absolute left-0 top-0">
      <line x1="13.5" y1="0" x2="13.5" y2={last ? tickY + 0.5 : '100%'} stroke="#B5823EB3" />
      <rect x="11.5" y={nodeY} width="4" height="4" fill={active ? '#D9A65E' : '#2C1707'} stroke={active ? '#D9A65E' : '#B5823E'} />
      <line x1="16" y1={tickY} x2="24" y2={tickY} stroke="#B5823E80" />
    </svg>
  );
}

const SUB_ROW = 26;

/** Nested rail for sub-links: a thinner line down the left with a tick into each row (no nodes). The last line stops at its tick. */
function SubLinks({
  items,
  activeSubKey,
  onNavigate,
}: {
  items: SidebarNavSubItem[];
  activeSubKey?: string;
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const lastTick = (items.length - 1) * SUB_ROW + SUB_ROW / 2;
  return (
    <div className="relative ml-[34px] pb-1 pt-0.5">
      <svg width="16" height="100%" aria-hidden className="pointer-events-none absolute left-0 top-0.5">
        <line x1="0.5" y1="0" x2="0.5" y2={lastTick} stroke="#B5823EB3" />
        {items.map((item, i) => (
          <line key={item.key} x1="0.5" y1={i * SUB_ROW + SUB_ROW / 2} x2="10" y2={i * SUB_ROW + SUB_ROW / 2} stroke="#B5823E80" />
        ))}
      </svg>
      {items.map((item) => {
        const active = item.key === activeSubKey;
        const rowClass = 'relative flex h-[26px] shrink-0 items-center rounded-wds-sm pl-[18px] pr-2 outline-none';
        const label = (
          <span className={cn('font-wds-sans text-wds-body-sm leading-4', active ? 'font-medium text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-item')}>{item.label}</span>
        );
        if (item.disabledHint) {
          return (
            <HintTooltip key={item.key} hint={item.disabledHint} side="top" className="flex">
              {(describedBy) => (
                <span role="link" tabIndex={0} aria-disabled="true" aria-describedby={describedBy} className={cn(rowClass, 'w-full cursor-not-allowed focus-visible:shadow-wds-ring')}>
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
            className={cn(rowClass, 'transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring', active && 'bg-[#D9A65E17]')}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function NavItemRow({
  item,
  first,
  last,
  active,
  activeSubKey,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: SidebarNavItem;
  first: boolean;
  last: boolean;
  active: boolean;
  activeSubKey?: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: (item: SidebarNavItem, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const Icon = item.icon;
  const hasSubItems = Boolean(item.subItems?.length);
  const subId = `sidebar-sub-${item.key}`;
  return (
    <div className={cn('relative pl-6', first && 'pt-1.5')}>
      <div className="relative">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate ? (e) => onNavigate(item, e) : undefined}
          className={cn(
            'flex h-8 items-center gap-wds-2.5 rounded-[2px] pl-wds-2.5 outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring',
            hasSubItems ? 'pr-8' : 'pr-1.5',
            active && 'bg-[#D9A65E17]'
          )}
        >
          <Icon className={cn('shrink-0', active ? 'text-wds-caramel-500' : 'text-wds-sidebar-fg-muted')} />
          <span className={cn('grow truncate font-wds-sans text-wds-body-sm', active ? 'font-medium text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-item')}>{item.label}</span>
          {item.count != null ? (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[2px] bg-wds-sidebar-badge-bg px-[5px]">
              <span className="font-wds-mono text-wds-overline font-semibold text-wds-sidebar-badge-fg">{item.count}</span>
            </span>
          ) : null}
        </Link>
        {hasSubItems ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={subId}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
            className="absolute right-1.5 top-1 flex size-6 items-center justify-center rounded-wds-sm text-wds-sidebar-fg-muted outline-none transition-colors hover:bg-wds-sidebar-active-bg hover:text-wds-sidebar-fg-active focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring"
          >
            <Chevron open={expanded} />
          </button>
        ) : null}
      </div>
      {hasSubItems && item.subItems ? (
        <div
          id={subId}
          aria-hidden={!expanded}
          className={cn(
            'grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none',
            expanded ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <SubLinks items={item.subItems} activeSubKey={active ? activeSubKey : undefined} onNavigate={onNavigate ? (href, e) => onNavigate({ ...item, href }, e) : undefined} />
          </div>
        </div>
      ) : null}
      <RailSvg first={first} last={last} active={active} />
      {active ? <span aria-hidden className={cn('absolute -left-2.5 h-8 w-0.5 bg-wds-sidebar-marker', first ? 'top-1.5' : 'top-0')} /> : null}
    </div>
  );
}

export function SidebarNav({ groups, activeKey, activeSubKey, user, orgLabel = 'HUB', logoSrc, onNavigate, onSignOut, className }: SidebarNavProps) {
  const activeGroupKey = groups.find((g) => g.items.some((i) => i.key === activeKey))?.key;
  const { isExpanded, toggle } = useExpandedItems(activeKey, activeGroupKey);
  return (
    <nav className={cn('flex h-full w-[236px] shrink-0 flex-col bg-wds-gradient-sidebar font-wds-sans text-wds-caption', className)}>
      <div className="flex h-14 shrink-0 items-center gap-wds-2.5 border-b border-[#38302A] px-wds-4.5">
        <div
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-cover bg-center shadow-[0_1px_0_0_rgb(255_255_255/0.10)_inset]"
          style={logoSrc ? { backgroundImage: `url(${logoSrc})` } : { backgroundColor: 'var(--wds-espresso-600)' }}
        />
        <span className="font-wds-sans text-wds-body-sm font-semibold tracking-tight text-wds-sidebar-fg-active">Wendo RMS</span>
        <span className="ml-auto font-wds-mono text-wds-overline text-wds-sidebar-fg-muted">{orgLabel}</span>
      </div>

      <div className="flex flex-col overflow-y-auto overflow-x-hidden px-wds-2.5 pb-wds-3.5 pt-wds-3.5">
        {groups.map((group, i) => {
          const groupKey = groupStateKey(group.key);
          const groupOpen = isExpanded(groupKey, true);
          const groupId = `sidebar-group-${group.key}`;
          return (
            <React.Fragment key={group.key}>
              <GroupHeader label={group.label} expanded={groupOpen} controlsId={groupId} onToggle={() => toggle(groupKey, true)} className={i === 0 ? 'mt-2' : 'mt-4'} />
              {/* The group slides open and shut; shut, it is invisible, so keyboard focus skips it. */}
              <div
                id={groupId}
                aria-hidden={!groupOpen}
                className={cn(
                  'grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none',
                  groupOpen ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
                )}
              >
                {/* Padded out to the sidebar's edge so the active item's left bar is not clipped by the slide-open wrapper. */}
                <div className="-mx-wds-2.5 min-h-0 overflow-hidden px-wds-2.5">
                  {group.items.map((item, itemIndex) => (
                    <NavItemRow
                      key={item.key}
                      item={item}
                      first={itemIndex === 0}
                      last={itemIndex === group.items.length - 1}
                      active={item.key === activeKey}
                      activeSubKey={activeSubKey}
                      expanded={Boolean(item.subItems?.length) && isExpanded(item.key, item.key === activeKey)}
                      onToggle={() => toggle(item.key, item.key === activeKey)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-auto flex h-[52px] shrink-0 items-center gap-wds-2.5 border-t border-[#38302A] px-wds-4.5">
        <Avatar>
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate font-wds-sans text-wds-caption font-medium text-wds-sidebar-fg-name">{user.name}</span>
          <span className="font-wds-sans text-wds-overline font-normal normal-case tracking-normal text-wds-sidebar-fg-muted">{user.role}</span>
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
                <span className="font-wds-mono text-[9px]/3 font-semibold text-wds-sidebar-badge-fg">{item.count}</span>
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
