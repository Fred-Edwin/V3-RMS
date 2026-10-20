import type { AccessSubject } from '../../_shared/workforce-access';
import { contextFor } from '../../needs-you';
import { conductNeedsYouSource } from './conduct-source';

/**
 * The number on the Conduct menu link for the caller (spec section 11): staff, notices to sign; a Branch Manager, notices to record;
 * HR, appeals waiting; the Director, appeals on HR-issued notices. Counted from the same rows the Home card shows, so the badge and the
 * card cannot disagree. Staff lack `needs_you.read`, which is why Conduct answers this itself.
 */
export async function conductBadge(subject: AccessSubject, now: Date = new Date()): Promise<{ count: number }> {
  const ctx = await contextFor(subject, now);
  const rows = await conductNeedsYouSource.list(subject, ctx);
  return { count: rows.length };
}
