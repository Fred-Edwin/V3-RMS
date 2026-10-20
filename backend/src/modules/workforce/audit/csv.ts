import { nairobiClockOf, nairobiDateOf } from '../_shared/time/nairobi-time';
import type { LogRow } from './audit-rows';

export const CSV_BOM = '﻿';
export const CSV_HEADER = ['When', 'Who', 'Role', 'Area', 'Event', 'What', 'Detail', 'Site', 'Reason', 'Entry number', 'Flagged'] as const;

/**
 * One CSV field. A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return would run as a formula when the file is
 * opened in a spreadsheet, so it gets a leading quote mark (A4). Commas, quotes and line breaks are wrapped and doubled as usual.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvLine = (fields: readonly string[]): string => `${fields.map(csvField).join(',')}\r\n`;

/** `2026-10-19 14:05`, Nairobi time. */
export const whenOf = (iso: string): string => {
  const at = new Date(iso);
  return `${nairobiDateOf(at)} ${nairobiClockOf(at)}`;
};

/** No hash, no device, no place, no amount: only what the log shows on its face. */
export const csvRow = (row: LogRow): string =>
  csvLine([whenOf(row.occurredAt), row.actor.name, row.actor.role, row.area, row.event, row.title, row.detail, row.siteName ?? '', row.reason ?? '', row.seq, row.flagged ? 'Yes' : 'No']);

export const exportFilename = (from: string, to: string): string => `Audit-log-${from}-to-${to}.csv`;
