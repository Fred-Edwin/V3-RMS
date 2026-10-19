'use client';

import * as React from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { timesheetReads } from '../../_shared/services/timesheet-services';
import { csvName, reportCsv } from '../../report/lib/report-view';

/** Export: reads the month's report and saves it as a spreadsheet file. Hours only. A failure comes back as words for the page to show. */
export function useExport(): { busy: boolean; error: string | null; run: (periodId: string) => Promise<void> } {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(async (periodId: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const report = await timesheetReads.report(periodId);
      const url = URL.createObjectURL(new Blob([`﻿${reportCsv(report)}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = csvName(report);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'The export did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run };
}
