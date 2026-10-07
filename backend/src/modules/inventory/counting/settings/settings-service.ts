import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { settingsInForce } from '../_shared/count-settings';
import { toPerson } from '../_shared/count-people';
import { previewOf, type PreviewSettings } from './settings-preview';
import { settingsRepository, type CountSettingsRecord } from './settings-repository';
import type { CountSettings, SettingsPreview, SettingsPreviewQuery, UpdateDirectorAlertInput, UpdateSettingsInput } from './settings.types';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** "How this plays out, last 7 days". */
export const PREVIEW_DAYS = 7;

const iso = (d: Date): string => d.toISOString();

/** The one place a settings row becomes the wire shape (the defaults fill in when the hub has no row). */
export const settingsView = (row: CountSettingsRecord | null, actor: Actor): CountSettings => {
  const inForce = settingsInForce(row);
  const rangeSaved = row?.updatedBy ?? null;
  const alertSaved = row?.directorUpdatedBy ?? null;
  return {
    rangeKes: inForce.rangeKes,
    rangePercent: inForce.rangePercent.toFixed(),
    flagRepeatShortfalls: inForce.flagRepeat,
    directorAlertKes: inForce.directorAlertKes,
    rangeUpdatedBy: rangeSaved ? toPerson(rangeSaved) : null,
    rangeUpdatedAt: row && rangeSaved ? iso(row.updatedAt) : null,
    alertUpdatedBy: alertSaved ? toPerson(alertSaved) : null,
    alertUpdatedAt: row?.directorUpdatedAt && alertSaved ? iso(row.directorUpdatedAt) : null,
    can: { editRange: actorCan(actor, 'counts.setup'), editDirectorAlert: actorCan(actor, 'counts.set_director_alert') },
  };
};

export const settingsService = {
  /** C23: the numbers in force, who set them and when, and whether the caller may change them. */
  get: async (actor: Actor): Promise<CountSettings> => {
    const siteId = await requireHubReader(actor);
    return settingsView(await settingsRepository.find(siteId), actor);
  },

  /** C24: the last seven days of signed counts, judged again with the proposed numbers (any left out stay as they are today). */
  preview: async (actor: Actor, query: SettingsPreviewQuery, now: Date = new Date()): Promise<SettingsPreview> => {
    const siteId = await requireHubReader(actor);
    const row = await settingsRepository.find(siteId);
    const current = settingsInForce(row);
    const currentSettings: PreviewSettings = { rangeKes: current.rangeKes, rangePercent: current.rangePercent, directorAlertKes: current.directorAlertKes };
    const proposed: PreviewSettings = {
      rangeKes: query.rangeKes ?? currentSettings.rangeKes,
      rangePercent: query.rangePercent !== undefined ? new Prisma.Decimal(query.rangePercent) : currentSettings.rangePercent,
      directorAlertKes: query.directorAlertKes ?? currentSettings.directorAlertKes,
    };
    const rows = await settingsRepository.signedLinesSince(siteId, new Date(now.getTime() - PREVIEW_DAYS * DAY_MS));
    return previewOf(rows, currentSettings, proposed);
  },

  /** C25: the range, the percent and the repeat-shortfall switch. They apply from the next signed count; signed counts keep theirs. */
  updateRange: async (actor: Actor, input: UpdateSettingsInput): Promise<CountSettings> => {
    const siteId = await requireHubActor(actor);
    const row = await settingsRepository.saveRange(siteId, {
      rangeKes: input.rangeKes,
      rangePercent: new Prisma.Decimal(input.rangePercent).toDecimalPlaces(2),
      flagRepeatShortfalls: input.flagRepeatShortfalls,
      updatedById: actor.id,
    });
    return settingsView(row, actor);
  },

  /** C26: the Director's alert amount, and nothing else on the row. */
  updateDirectorAlert: async (actor: Actor, input: UpdateDirectorAlertInput, now: Date = new Date()): Promise<CountSettings> => {
    const siteId = await requireHubActor(actor);
    const existing = await settingsRepository.find(siteId);
    const row = await settingsRepository.saveDirectorAlert(siteId, {
      alertKes: input.alertKes,
      updatedById: actor.id,
      at: now,
      keepRangeStamp: existing?.updatedAt ?? null,
    });
    return settingsView(row, actor);
  },
};
