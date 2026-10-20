import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { StageView } from '../_shared/types/month-types';
import { StageLine } from './components/stage-line';

const stage = (number: number, key: string, name: string, status: StageView['status']): StageView => ({ number, key, name, status } as StageView);
const six: StageView[] = [
  stage(1, 'TIMESHEETS', 'Timesheets approved', 'DONE'),
  stage(2, 'CALCULATED', 'Calculated', 'DONE'),
  stage(3, 'REVIEWED', 'Reviewed', 'CURRENT'),
  stage(4, 'APPROVED', 'Approved', 'TODO'),
  stage(5, 'PUBLISHED', 'Published', 'TODO'),
  stage(6, 'PAID', 'Paid', 'TODO'),
];

describe('the stage line', () => {
  const html = renderToStaticMarkup(React.createElement(StageLine, { stages: six }));

  it('is an ordered list of six steps, and only the current one is marked as the current step', () => {
    expect(html.match(/<li /g)).toHaveLength(6);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it('draws a check for done stages and the number for the others, never colour alone', () => {
    expect(html.match(/✓/g)).toHaveLength(2);
    for (const n of ['>3<', '>4<', '>5<', '>6<']) expect(html).toContain(n);
  });

  it('draws nothing when the month has no stages (an open month)', () => {
    expect(renderToStaticMarkup(React.createElement(StageLine, { stages: [] }))).toBe('');
  });
});
