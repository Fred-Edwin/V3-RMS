import type { NavIcon } from '../nav-icons';

/** What the sidebar draws: the table's menu with each link's number and urgency filled in (`use-shell-nav.ts`). */

export interface MenuSub {
  key: string;
  label: string;
  href: string;
  /** What waits here. Zero or missing draws nothing. */
  count?: number;
  /** Something here is overdue or blocks payroll: the red-brown dot. */
  urgent?: boolean;
  /** The caption this link sits under ("Staff", "Time"); the sidebar draws it where it changes from the link above. */
  section?: string;
}

export interface MenuItem {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  count?: number;
  urgent?: boolean;
  subItems?: MenuSub[];
}

export interface MenuNavModel {
  top: MenuItem[];
  features: MenuItem[];
  /** Personal items, opened from the name at the bottom. */
  account: MenuItem[];
}

export interface MenuUser {
  name: string;
  role: string;
  initials: string;
}
