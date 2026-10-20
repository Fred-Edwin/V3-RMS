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

export interface NotificationPage {
  items: WorkforceNotification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}
