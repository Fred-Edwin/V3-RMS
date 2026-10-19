import { DOC_COLOURS } from '../../../_shared';
import { hmWords, wholeHours } from '../../_shared/lib/timesheet-words';
import type { Report, ReportRow } from '../../_shared/types/timesheet-types';
import { colonHours, decidedBy } from '../lib/report-view';

const HEAD = 'border-b-2 px-1 py-1 text-[13px] font-bold';

/** A person with nothing but the system's own approval: the report counts them in one line, as Paper does. */
export const onlySystem = (row: ReportRow): boolean => row.notes.length > 0 && row.notes.every((n) => n.code === 'APPROVED_BY_SYSTEM') && row.lateMinutes === 0 && row.absentDays === 0 && row.overtimeAuthorisedMinutes === 0;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 border-l px-3.5 py-2.5 first:border-l-0" style={{ borderColor: DOC_COLOURS.rule }}>
      <span className="text-[11px] uppercase leading-[14px] tracking-[0.12em] text-wds-neutral-700">{label}</span>
      <span className="text-[20px] font-bold leading-6" style={{ color: DOC_COLOURS.navy }}>
        {value}
      </span>
    </div>
  );
}

/** The six figures and the people table of one month. Hours only: nothing on this page is money. */
export function ReportTable({ report }: { report: Report }) {
  const { summary } = report;
  const shown = report.rows.filter((r) => !onlySystem(r));
  const quiet = report.rows.length - shown.length;
  return (
    <>
      <div className="mt-5 flex border" style={{ borderColor: DOC_COLOURS.rule }}>
        <Figure label="People" value={String(summary.people)} />
        <Figure label="Planned" value={wholeHours(summary.plannedMinutes)} />
        <Figure label="Worked" value={wholeHours(summary.workedMinutes)} />
        <Figure label="Overtime authorised" value={hmWords(summary.overtimeAuthorisedMinutes)} />
        <Figure label="Late (minutes)" value={String(summary.lateMinutes)} />
        <Figure label="Absent days" value={String(summary.absentDays)} />
      </div>
      <table className="mt-5 w-full border-collapse text-[13px]" style={{ borderTop: `2px solid ${DOC_COLOURS.ink}` }}>
        <thead>
          <tr style={{ color: DOC_COLOURS.navy }}>
            <th className={`${HEAD} text-left`} style={{ borderColor: DOC_COLOURS.ink }}>Person</th>
            <th className={`${HEAD} text-left`} style={{ borderColor: DOC_COLOURS.ink }}>Department</th>
            <th className={`${HEAD} text-right`} style={{ borderColor: DOC_COLOURS.ink }}>Planned</th>
            <th className={`${HEAD} text-right`} style={{ borderColor: DOC_COLOURS.ink }}>Worked</th>
            <th className={`${HEAD} text-right`} style={{ borderColor: DOC_COLOURS.ink }}>Late</th>
            <th className={`${HEAD} text-right`} style={{ borderColor: DOC_COLOURS.ink }}>Absent</th>
            <th className={`${HEAD} text-right`} style={{ borderColor: DOC_COLOURS.ink }}>Overtime</th>
            <th className={`${HEAD} pl-6 text-left`} style={{ borderColor: DOC_COLOURS.ink }}>Decided by</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.employeeId} className="h-[22px] border-b" style={{ borderColor: DOC_COLOURS.rule }}>
              <td className="whitespace-nowrap pr-2">{row.name}</td>
              <td className="text-wds-neutral-700">{row.departmentName ?? ''}</td>
              <td className="text-right tabular-nums">{colonHours(row.plannedMinutes)}</td>
              <td className="text-right tabular-nums">{colonHours(row.workedMinutes)}</td>
              <td className="text-right tabular-nums">{row.lateMinutes}</td>
              <td className="text-right tabular-nums">{row.absentDays}</td>
              <td className="text-right tabular-nums">{colonHours(row.overtimeAuthorisedMinutes)}</td>
              <td className="pl-6 text-[12px] text-wds-neutral-700">{decidedBy(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {quiet > 0 ? (
        <p className="m-0 mt-2 text-[13px] italic text-wds-neutral-700">
          … {quiet} more {quiet === 1 ? 'person' : 'people'}, all approved by the system
        </p>
      ) : null}
      {report.carriedOnDays + report.carriedOnOvertime > 0 ? (
        <p className="m-0 mt-2 text-[13px] text-wds-neutral-700">
          {report.carriedOnDays} {report.carriedOnDays === 1 ? 'day' : 'days'} and {report.carriedOnOvertime} overtime {report.carriedOnOvertime === 1 ? 'answer' : 'answers'} were still open and moved to the next month for HR.
        </p>
      ) : null}
    </>
  );
}
