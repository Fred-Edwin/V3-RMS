export const ALERT_KINDS = ['WASNT_ME', 'UNCONFIRMED_PHONE', 'WRONG_CODES', 'CHAIN_FAILED'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertStatus = 'OPEN' | 'CLEARED';

/** The wording row each alert kind uses for the System Admin (server wording table, `notifications/wording-shared.ts`). */
export const ALERT_WORDING: Record<AlertKind, string> = {
  WASNT_ME: 'security.wasnt_me_admin',
  UNCONFIRMED_PHONE: 'payslip.on_unconfirmed_phone_admin',
  WRONG_CODES: 'payslip.three_wrong_codes_admin',
  CHAIN_FAILED: 'audit.chain_failed',
};

/** At most one alert per person, kind and 15 minutes (6a S1). */
export const ALERT_WINDOW_MS = 15 * 60_000;

/** A confirmation of "Use it just once" holds for the session; there is no server session, so it ends after this long. */
export const ONCE_CONFIRMATION_MS = 12 * 3_600_000;

export interface AlertRow {
  id: string;
  kind: AlertKind;
  status: AlertStatus;
  occurredAt: string;
  person: { id: string; name: string; role: string } | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  detail: string | null;
  siteId: string | null;
  auditEntryId: string | null;
  clearedBy: { id: string; name: string; role: string } | null;
  clearedAt: string | null;
  clearNote: string | null;
}
