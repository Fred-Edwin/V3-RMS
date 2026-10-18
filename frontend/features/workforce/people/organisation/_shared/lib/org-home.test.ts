import { describe, expect, it } from 'vitest';

import type { DepartmentSummary, OrgOverview } from '../types/org-types';
import { gapRows } from './org-home';

const dept = (over: Partial<DepartmentSummary>): DepartmentSummary => ({ id: 'd', organizationId: 's', name: 'Pastry', inventoryTag: 'PASTRY', description: null, isActive: true, people: 0, head: null, actingHead: null, hasGap: true, ...over });

describe('gapRows', () => {
  it('makes one row per branch department with no head, and none for the Central Store or a retired department', () => {
    const o: OrgOverview = {
      counts: { organizations: 2, departments: 4, heads: 0, gaps: 2 },
      organizations: [
        { id: 's1', name: 'Nyeri Town', type: 'BRANCH', isHub: false, headsAllowed: true, gaps: 2, departments: [dept({ id: 'a' }), dept({ id: 'b', name: 'Kitchen', hasGap: false }), dept({ id: 'c', isActive: false })] },
        { id: 's2', name: 'Central Store', type: 'CENTRAL_STORE', isHub: true, headsAllowed: false, gaps: 0, departments: [dept({ id: 'e', hasGap: false })] },
      ],
    };
    expect(gapRows(o)).toEqual([{ key: 'no-head:a', departmentId: 'a', title: 'No head for Pastry', detail: 'Nyeri Town · approvals go to the Branch Manager for now', age: 'NO HEAD', action: 'Assign head' }]);
  });
});
