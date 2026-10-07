import type { RunSummary } from '../_shared/prep-contract';

/** The first bytes of the file, so Excel reads the Unicode minus and the names as UTF-8. */
export const CSV_BOM = '﻿';

const STATUS_WORDS: Record<RunSummary['status'], string> = { RECORDED: 'Recorded', CORRECTED: 'Corrected', CANCELLED: 'Cancelled' };

/** Quotes a cell when it holds a comma, quote or line break. */
const cell = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** A typed name that starts with = + - @ would run as a formula in a spreadsheet; a leading apostrophe keeps it text. */
const textCell = (value: string): string => cell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

/** "2026-10-07 08:15", the Nairobi wall clock (UTC+3, no daylight saving). */
const nairobiStamp = (iso: string): string => new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');

/** Run rows to CSV text: header, then one line per run, `\r\n` between lines. The cost column is there only when asked for. */
export const runsToCsv = (rows: readonly RunSummary[], withCosts: boolean): string => {
  const header = ['When', 'Run', 'Output', 'Made', 'Unit', 'Vs usual', 'By', 'Status', 'Reviewed by', ...(withCosts ? ['Unit cost'] : [])];
  const lines = rows.map((run) =>
    [
      nairobiStamp(run.at),
      run.reference,
      textCell(run.outputName),
      run.made,
      run.unit,
      cell(run.vsUsual.text),
      textCell(run.by.name),
      STATUS_WORDS[run.status],
      run.reviewedBy ? textCell(run.reviewedBy.name) : '',
      ...(withCosts ? [run.outputUnitCost ?? ''] : []),
    ].join(','),
  );
  return CSV_BOM + [header.join(','), ...lines].join('\r\n') + '\r\n';
};
