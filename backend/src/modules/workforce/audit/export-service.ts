import { ValidationError } from '../../../utils/errors';
import { runAudited } from '../_shared/audit/audit-writer';
import type { AccessSubject } from '../_shared/workforce-access';
import { COUNT_CAP, auditReadRepository } from './audit-read-repository';
import { rangeOf } from './audit-range';
import type { ExportQuery } from './audit-validators';
import { CSV_BOM, CSV_HEADER, csvLine, csvRow, exportFilename } from './csv';
import { entriesFor, filterOf, readerOf } from './list-service';

const BATCH = 1_000;

export interface CsvExport {
  filename: string;
  rows: number;
  /** The file in chunks, so a 50,000 row export is never held in memory at once. */
  chunks: () => AsyncGenerator<string>;
}

/**
 * A4. The exact filtered view the reader may see, at most 50,000 rows. The written entry (`audit.exported`: filters and row count,
 * never the rows) is committed before the first byte leaves, so an export cannot happen without a record of it.
 */
export async function prepareExport(subject: AccessSubject, query: ExportQuery, now: Date = new Date()): Promise<CsvExport> {
  const reader = await readerOf(subject);
  const range = rangeOf(query.from, query.to, now);
  const filter = filterOf(reader, { ...query }, range);
  const counted = filter ? await auditReadRepository.countCapped(filter) : 0;
  if (counted === 0 || !filter) throw new ValidationError('Nothing to export.', 'NOTHING_TO_EXPORT');
  if (counted > COUNT_CAP) throw new ValidationError('Too many to export. Narrow the dates.', 'EXPORT_TOO_LARGE');

  await runAudited<void>(async () => ({
    result: undefined,
    entries: [
      {
        companyId: reader.ctx.companyId,
        siteId: subject.siteId ?? null,
        actor: reader.ctx.auditActor,
        action: 'audit.exported',
        category: 'LOG_ACCESS',
        subjectType: 'AuditLog',
        subjectId: reader.ctx.companyId,
        after: { rows: counted, from: range.from, to: range.to, event: query.event, area: query.area ?? null, flagged: query.flagged ?? false, search: query.q ? true : false },
      },
    ],
  }));

  async function* chunks(): AsyncGenerator<string> {
    yield CSV_BOM + csvLine(CSV_HEADER);
    for (let offset = 0; offset < counted; offset += BATCH) {
      const page = await auditReadRepository.page(filter!, query.sort, offset, BATCH);
      if (page.length === 0) return;
      const rows = await entriesFor(reader, page.map((p) => p.entryId), new Map(page.map((p) => [p.entryId, p.area])));
      yield rows.map(csvRow).join('');
    }
  }
  return { filename: exportFilename(range.from, range.to), rows: counted, chunks };
}
