/** What a caller hands the notifier: short facts only (names, roles, dates, counts). Never a pay figure, a code or a PIN. */
export type NotifyData = Record<string, string | number | null>;

/** The five kinds of Paper's wording table; they set the coloured bar and the push priority. */
export type NotificationTone = 'information' | 'changed' | 'needsLook' | 'done' | 'problem';

export const NOTIFICATION_AREAS = ['PAY', 'TIME', 'LEAVE', 'PEOPLE', 'RULES', 'SECURITY', 'CONDUCT', 'DOCUMENTS'] as const;
export type NotificationArea = (typeof NOTIFICATION_AREAS)[number];

/** A kind's words, rendered on the server at send time, so a stored row never changes and the push says the same thing. */
export interface RenderedNotification {
  title: string;
  body: string;
  tone: NotificationTone;
  area: NotificationArea;
  href: string | null;
  /** false = an Inbox row and a nudge only (for example "leave asked", which is a Needs you row). */
  push: boolean;
  /** Set when the lock-screen text must not repeat the row (Conduct, C27): the push carries this title and body instead. */
  pushText?: { title: string; body: string };
}

export interface NotifyOptions {
  /** Kind + subject + window. A second call with the same key for the same person is a duplicate. */
  dedupeKey?: string;
  /** On a duplicate, update the existing row (a running count) instead of ignoring the call. */
  replace?: boolean;
  /** Override the 22:00 to 05:00 rule: problems and "needs a look" go at once anyway (SD13). */
  now?: Date;
}

export interface StoredNotification {
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
