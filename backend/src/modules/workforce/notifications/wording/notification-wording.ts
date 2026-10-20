import type { NotifyData, RenderedNotification } from '../notification-types';
import { BUILT_WORDING } from './wording-built';
import { CONDUCT_WORDING } from './wording-conduct';
import { LEAVE_WORDING } from './wording-leave';
import { KIND_ALIASES, SHARED_WORDING } from './wording-shared';

const ALL = { ...BUILT_WORDING, ...SHARED_WORDING, ...CONDUCT_WORDING, ...LEAVE_WORDING };

/** A pay figure in words: a number next to KES/Ksh, or KES/Ksh next to a number. A rendered row must never contain one. */
const FIGURE = /(\d[\d,.]*\s*(kes|ksh|shillings?))|((kes|ksh)\.?\s*\d)/i;

const UNKNOWN: RenderedNotification = { tone: 'information', area: 'PEOPLE', href: null, title: 'Something changed', body: 'Open the app to see what changed.', push: false };

export const isKnownKind = (kind: string): boolean => (KIND_ALIASES[kind] ?? kind) in ALL;
export const knownKinds = (): string[] => [...Object.keys(ALL), ...Object.keys(KIND_ALIASES)];

/**
 * Renders a kind's words from its facts. The one table both the Inbox row and the push read, so they always agree. An unknown kind
 * becomes a plain "Something changed" row that does not push. Defence in depth: should the words ever contain a pay figure (a
 * caller passing one by mistake), the row falls back to the plain version rather than leak it.
 */
export function renderNotification(kind: string, data: NotifyData): RenderedNotification {
  const wording = ALL[KIND_ALIASES[kind] ?? kind];
  if (!wording) return UNKNOWN;
  const rendered = wording(data);
  return FIGURE.test(rendered.title) || FIGURE.test(rendered.body) ? { ...UNKNOWN, tone: rendered.tone, area: rendered.area, href: rendered.href } : rendered;
}
