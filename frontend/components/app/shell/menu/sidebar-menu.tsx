'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback } from '@/components/ui2/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { ACCOUNT_KEY, accountGroupOf, underNameOf } from './account-group';
import { ShellSearch } from '../search/shell-search';
import { flatLinks } from '../search/search-logic';
import { AMBER, MARK_NUMBER, RED_BROWN, markOf, markSpoken, markText, sumMark, type Mark } from './attention';
import type { MenuItem, MenuNavModel, MenuSub, MenuUser } from './menu-types';

/**
 * The sidebar of Paper 2.1 to 2.7: the logo, Search (Ctrl K), Home, then one row per feature. Only the feature you are in is open; it
 * opens with its links, split by small captions (Staff, Time, Pay, Setup), each caption starting its own short connector line. A closed feature shows one dot
 * and the total of its links; an open one shows the numbers on the links, never on the parent (Paper 7.6). The personal links (My file,
 * My payslips, ...) are the last group, "My account" (Paper 2.8). Your name at the bottom opens Profile and Sign out.
 */

/** The dot and the small number. Decorative text is hidden from a screen reader, which hears "3 waiting" once. */
function AttentionMark({ mark }: { mark: Mark }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5" data-mark={mark.urgent ? 'urgent' : 'waiting'}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: mark.urgent ? RED_BROWN : AMBER }} />
      <span aria-hidden className="font-wds-mono text-[11px] font-medium leading-none" style={{ color: MARK_NUMBER }}>
        {markText(mark.count)}
      </span>
      <span className="sr-only">{markSpoken(mark)}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={cn('shrink-0 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}>
      <path d="M1.5 3 5 6.5 8.5 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

const ROW = 'flex h-8 w-full items-center gap-wds-2.5 rounded-[2px] pl-wds-2.5 pr-2 text-left outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring';

function TopRow({ item, active, onNavigate }: { item: MenuItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} onClick={onNavigate} className={cn(ROW, 'h-9', active && 'bg-[#D9A65E17]')}>
      <Icon className={cn('shrink-0', active ? 'text-wds-caramel-500' : 'text-wds-sidebar-fg-muted')} />
      <span className={cn('grow truncate font-wds-sans text-wds-body-sm', active ? 'font-medium text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-item')}>{item.label}</span>
    </Link>
  );
}

/**
 * One link of an open feature, on its section's rail: a 24 px lane, a short tick, and a square node (filled when active). The line runs
 * down through the 2 px gap to the next link and stops at the node of the last link of a section, so every caption starts a new line.
 */
function SubRow({ sub, active, last, onNavigate }: { sub: MenuSub; active: boolean; last: boolean; onNavigate?: () => void }) {
  const mark = markOf(sub.count, sub.urgent);
  return (
    <Link
      href={sub.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn('relative flex h-8 items-center rounded-[2px] pl-[34px] pr-2 outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring', active && 'bg-[#D9A65E17]')}
    >
      <span aria-hidden className={cn('absolute left-[23.5px] top-0 w-px bg-[#B5823EB3]', last ? 'h-[17px]' : 'h-[34px]')} />
      <span aria-hidden className="absolute left-[24px] top-1/2 h-px w-[8px] -translate-y-1/2 bg-[#B5823E80]" />
      <span aria-hidden className={cn('absolute left-[21.5px] top-1/2 size-[4px] -translate-y-1/2 border', active ? 'border-[#D9A65E] bg-[#D9A65E]' : 'border-[#B5823E] bg-[#2C1707]')} />
      {active ? <span aria-hidden className="absolute -left-2.5 top-0 h-8 w-0.5 bg-wds-sidebar-marker" /> : null}
      <span className={cn('grow truncate font-wds-sans text-wds-body-sm', active ? 'font-medium text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-item')}>{sub.label}</span>
      {mark ? <AttentionMark mark={mark} /> : null}
    </Link>
  );
}

function Caption({ text }: { text: string }) {
  return <div className="relative mt-1.5 flex h-6 items-center pl-[34px] pr-2.5 font-wds-mono text-[10px] font-semibold leading-3 tracking-[0.06em] text-wds-sidebar-fg-muted">{text.toUpperCase()}</div>;
}

function FeatureRow({ item, open, activeKey, activeSubKey, onToggle, onNavigate }: { item: MenuItem; open: boolean; activeKey: string; activeSubKey?: string; onToggle: () => void; onNavigate?: () => void }) {
  const Icon = item.icon;
  const subs = item.subItems ?? [];
  const mark = open ? null : sumMark(subs);
  const here = item.key === activeKey;
  const listId = `menu-${item.key}`;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={listId} className={cn(ROW, 'h-9')}>
        <Icon className={cn('shrink-0', here ? 'text-wds-caramel-500' : 'text-wds-sidebar-fg-muted')} />
        <span className={cn('grow truncate font-wds-sans text-wds-body-sm', here || open ? 'font-medium text-wds-sidebar-fg-active' : 'text-wds-sidebar-fg-item')}>{item.label}</span>
        {mark ? <AttentionMark mark={mark} /> : null}
        <span className="ml-1 text-wds-sidebar-fg-muted">
          <Chevron open={open} />
        </span>
      </button>
      <div id={listId} hidden={!open} className={cn('relative flex-col gap-0.5 pt-0.5', open ? 'flex' : 'hidden')}>
        {subs.map((sub, i) => (
          <React.Fragment key={sub.key}>
            {sub.section && sub.section !== subs[i - 1]?.section ? <Caption text={sub.section} /> : null}
            <SubRow sub={sub} active={here && sub.key === activeSubKey} last={subs[i + 1]?.section !== sub.section || !subs[i + 1]} onNavigate={onNavigate} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export interface SidebarMenuProps {
  menu: MenuNavModel;
  activeKey: string;
  activeSubKey?: string;
  user: MenuUser;
  orgLabel?: string;
  logoSrc?: string;
  onNavigate?: () => void;
  onSignOut?: () => void;
  className?: string;
}

export function SidebarMenu({ menu, activeKey: pageKey, activeSubKey: pageSubKey, user, orgLabel = 'COMPANY', logoSrc, onNavigate, onSignOut, className }: SidebarMenuProps) {
  const accountGroup = React.useMemo(() => accountGroupOf(menu.account), [menu.account]);
  // A personal page lights its link inside the group.
  const inAccount = accountGroup !== null && menu.account.some((a) => a.key === pageKey);
  const activeKey = inAccount ? ACCOUNT_KEY : pageKey;
  const activeSubKey = inAccount ? pageKey : pageSubKey;
  const features = accountGroup ? [...menu.features, accountGroup] : menu.features;
  // Only the feature you are in is open; you can open another with its chevron, and moving into one opens it again.
  const [opened, setOpened] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    if (activeKey.startsWith('feature-')) setOpened((o) => ({ ...o, [activeKey]: true }));
  }, [activeKey]);
  const isOpen = (key: string): boolean => opened[key] ?? key === activeKey;
  const links = React.useMemo(() => flatLinks([...menu.top.map((i) => ({ key: i.key, label: '', items: [i] })), ...menu.features.map((f) => ({ key: f.key, label: f.label, items: [f] })), { key: 'account', label: 'Account', items: menu.account }]), [menu]);
  const canSeePeople = links.some((l) => l.href === '/app/workforce/employees');
  // Under the name: Profile (and Sign out). The rest of the personal links are in the My account group.
  const underName = underNameOf(menu.account, accountGroup !== null);

  return (
    <nav aria-label="Main" className={cn('flex h-full w-[236px] shrink-0 flex-col bg-wds-gradient-sidebar font-wds-sans text-wds-caption', className)}>
      <div className="flex h-14 shrink-0 items-center gap-wds-2.5 border-b border-[#38302A] px-wds-4.5">
        <div className="h-[22px] w-[22px] shrink-0 rounded-full bg-cover bg-center shadow-[0_1px_0_0_rgb(255_255_255/0.10)_inset]" style={logoSrc ? { backgroundImage: `url(${logoSrc})` } : { backgroundColor: 'var(--wds-espresso-600)' }} />
        <span className="font-wds-sans text-wds-body-sm font-semibold tracking-tight text-wds-sidebar-fg-active">Wendo RMS</span>
        <span className="ml-auto font-wds-mono text-wds-overline text-wds-sidebar-fg-muted">{orgLabel}</span>
      </div>

      <div className="px-wds-2.5 pb-2 pt-3">
        <ShellSearch links={links} canSeePeople={canSeePeople} variant="sidebar" />
      </div>

      <div className="flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-wds-2.5 pb-wds-3.5 [scrollbar-color:#4A3A2C_transparent] [scrollbar-width:thin]">
        {menu.top.map((item) => (
          <TopRow key={item.key} item={item} active={item.key === activeKey} onNavigate={onNavigate} />
        ))}
        {features.map((item) => (
          <FeatureRow
            key={item.key}
            item={item}
            open={isOpen(item.key)}
            activeKey={activeKey}
            activeSubKey={activeSubKey}
            onToggle={() => setOpened((o) => ({ ...o, [item.key]: !isOpen(item.key) }))}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="mt-auto shrink-0 border-t border-[#38302A]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`${user.name}, ${user.role}: personal menu`} className="flex h-[56px] w-full items-center gap-wds-2.5 px-wds-4.5 text-left outline-none transition-colors hover:bg-wds-sidebar-active-bg focus-visible:bg-wds-sidebar-active-bg focus-visible:shadow-wds-ring">
              <Avatar>
                <AvatarFallback>{user.initials}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="truncate font-wds-sans text-wds-caption font-medium text-wds-sidebar-fg-name">{user.name}</span>
                <span className="truncate font-wds-sans text-wds-overline font-normal text-wds-sidebar-fg-muted">{user.role}</span>
              </span>
              <span className="text-wds-sidebar-fg-muted">
                <Chevron open={false} />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[220px]">
            {underName.map((item) => (
              <DropdownMenuItem key={item.key} asChild>
                <Link href={item.href} onClick={onNavigate}>
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
            {onSignOut ? (
              <>
                {underName.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onSelect={onSignOut}>Sign out</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
