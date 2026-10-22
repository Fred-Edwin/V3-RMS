/** The five kinds of Paper's wording table; the server stores one per row and the Inbox colours the left bar by it. */
export type NotificationTone = 'information' | 'changed' | 'needsLook' | 'done' | 'problem';

/** The mono area label the server stamps on a row. */
export type NotificationArea = 'PAY' | 'TIME' | 'LEAVE' | 'PEOPLE' | 'RULES' | 'SECURITY' | 'CONDUCT' | 'DOCUMENTS';

/** One Inbox row, wording rendered on the server at send time (never a pay figure, a code or a conduct reason). */
export interface WorkforceNotification {
  id: string;
  kind: string;
  tone: NotificationTone;
  area: NotificationArea;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

/** What the list asks for: the page, and the filters of the drawer and the phone page. */
export interface NotificationQuery {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
  area: NotificationArea | null;
  q: string;
}

export interface NotificationPage {
  items: WorkforceNotification[];
  /** Rows that match the filters (what the pager counts). */
  total: number;
  /** Every row the person has: the number on the "All" chip. */
  all: number;
  /** Rows per area before any filter: the numbers on the area chips. */
  areas: Array<{ area: NotificationArea; count: number }>;
  unread: number;
  page: number;
  pageSize: number;
}
