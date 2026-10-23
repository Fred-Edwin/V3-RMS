import { describe, expect, it } from 'vitest';
import type { EmployeeFile, ProbationNoteView } from '../../../_shared/types/people-types';
import { headReportBlock, reportNeedsWords, reportReaders } from '../probation-report';

describe('who can read a probation report', () => {
  it('is said for the writer: a head, a manager, HR', () => {
    expect(reportReaders('CHEF')).toBe('Only HR and your Branch Manager can read this.');
    expect(reportReaders('MANAGER')).toBe('Only HR and the Director can read this.');
    expect(reportReaders('HR_MANAGER')).toBe('Only HR and the managers of this site can read this.');
  });
});

const note = (over: Partial<ProbationNoteView>): ProbationNoteView => ({ authorName: 'Victor Maina', authorPosition: 'Head of Kitchen', authorKind: 'HEAD', verdict: 'GOOD', note: null, createdOn: '2026-10-19', ...over });
const file = (notes: ProbationNoteView[]): Pick<EmployeeFile, 'probation'> => ({ probation: { notes } as unknown as EmployeeFile['probation'] });

describe('the head report in HR’s Decide dialog', () => {
  it('shows who wrote it, when it was sent and the note', () => {
    expect(headReportBlock(file([note({ verdict: 'NEEDS_WORK', note: 'Late twice.' })]))).toEqual({ verdict: 'NEEDS_WORK', verdictLabel: 'Needs work', from: 'Victor Maina · Head of Kitchen', sent: 'SENT 19 OCT', note: 'Late twice.' });
  });
  it('is null when only the Branch Manager wrote a note, so the dialog says "No report yet"', () => {
    expect(headReportBlock(file([note({ authorKind: 'BRANCH_MANAGER' })]))).toBeNull();
    expect(headReportBlock(file([]))).toBeNull();
  });
  it('uses the newest report from the head', () => {
    expect(headReportBlock(file([note({ createdOn: '2026-10-01', verdict: 'NOT_GOOD' }), note({ createdOn: '2026-10-19' })]))?.verdict).toBe('GOOD');
  });
  it('asks for words unless the report is Good', () => {
    expect(reportNeedsWords('GOOD')).toBe(false);
    expect(reportNeedsWords('NEEDS_WORK')).toBe(true);
    expect(reportNeedsWords(null)).toBe(false);
  });
});
