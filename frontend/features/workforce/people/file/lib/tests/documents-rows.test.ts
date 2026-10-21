import { describe, expect, it } from 'vitest';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { documentLines } from '../documents-rows';

const file = (over: Partial<EmployeeFile> = {}): EmployeeFile =>
  ({ name: 'Joy Chebet', employment: 'MONTHLY', status: 'ACTIVE', contractStatus: 'ACTIVE', probation: null, nextSteps: [], timeline: [], ...over }) as unknown as EmployeeFile;

describe('Documents tab lines (finding 19)', () => {
  it('lists a recorded contract that has no scanned copy', () => {
    const lines = documentLines(file({ timeline: [{ on: '2026-07-14', kind: 'CONTRACT', detail: { type: 'Fixed term' } }] }), []);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ title: 'Employment contract', status: { label: 'Recorded' }, documentId: null });
    expect(lines[0]?.detail).toContain('Fixed term');
  });

  it('shows the uploaded contract once, not a second recorded line', () => {
    const doc = { id: 'd1', documentType: 'CONTRACT', fileName: 'c.pdf', uploadedByName: 'HR', uploadedOn: '2026-07-15' };
    const lines = documentLines(file({ timeline: [{ on: '2026-07-14', kind: 'CONTRACT', detail: {} }] }), [doc as never]);
    expect(lines.map((l) => l.key)).toEqual(['d1']);
  });

  it('shows nothing for a person with no contract recorded', () => {
    expect(documentLines(file({ employment: 'CASUAL' as never, contractStatus: 'NONE' as never }), [])).toEqual([]);
  });
});
