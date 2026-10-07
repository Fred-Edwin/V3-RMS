import { Prisma } from '@prisma/client';

/**
 * The settings a count is judged against (contract §2.3): "worth up to" KES and "at most" percent (both must hold), the
 * repeat-shortfall switch, and the Director alert amount. The hub's `counting_thresholds` row holds them; with no row these
 * defaults apply. This file is pure: reading the row is `count-settings-repository.ts`.
 */
export type CountSettingsInForce = {
  rangeKes: number;
  rangePercent: Prisma.Decimal;
  flagRepeat: boolean;
  directorAlertKes: number;
};

export const COUNT_SETTING_DEFAULTS = { rangeKes: 500, rangePercent: 5, flagRepeat: true, directorAlertKes: 5000 } as const;

/** What the row says, when the columns that may be null are null: the defaults fill in. */
export type CountSettingsRow = {
  reasonRequiredKes: number;
  rangePercent: Prisma.Decimal;
  flagRepeatShortfalls: boolean;
  directorAlertKes: number | null;
};

export const settingsInForce = (row: CountSettingsRow | null): CountSettingsInForce =>
  row
    ? {
        rangeKes: row.reasonRequiredKes,
        rangePercent: row.rangePercent,
        flagRepeat: row.flagRepeatShortfalls,
        directorAlertKes: row.directorAlertKes ?? COUNT_SETTING_DEFAULTS.directorAlertKes,
      }
    : {
        rangeKes: COUNT_SETTING_DEFAULTS.rangeKes,
        rangePercent: new Prisma.Decimal(COUNT_SETTING_DEFAULTS.rangePercent),
        flagRepeat: COUNT_SETTING_DEFAULTS.flagRepeat,
        directorAlertKes: COUNT_SETTING_DEFAULTS.directorAlertKes,
      };

/** The settings frozen on a signed count; null while the count is OPEN (the live settings apply) or on a row from before the freeze. */
export const frozenSettingsOf = (count: {
  rangeKes: number | null;
  rangePercent: Prisma.Decimal | null;
  directorAlertKes: number | null;
  flagRepeat: boolean | null;
}): CountSettingsInForce | null =>
  count.rangeKes === null || count.rangePercent === null || count.directorAlertKes === null || count.flagRepeat === null
    ? null
    : { rangeKes: count.rangeKes, rangePercent: count.rangePercent, flagRepeat: count.flagRepeat, directorAlertKes: count.directorAlertKes };
