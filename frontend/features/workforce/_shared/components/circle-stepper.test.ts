import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CircleStepper, type CircleStep } from './circle-stepper';

const steps: CircleStep[] = [
  { key: 'issued', state: 'done', title: 'Issued to you', line: 'Fri 9 Oct, 16:42' },
  { key: 'sign', state: 'current', title: 'Sign that you received it', line: 'By Mon 12 Oct' },
  { key: 'appeal', state: 'todo', title: 'You can appeal' },
  { key: 'end', state: 'amber', title: 'Given, not signed' },
  { key: 'no', state: 'declined', title: 'Declined' },
];
const html = renderToStaticMarkup(createElement(CircleStepper, { steps, label: 'Where this notice is' }));

describe('CircleStepper', () => {
  it('is an ordered list with a name, one item per step', () => {
    expect(html).toContain('<ol');
    expect(html).toContain('aria-label="Where this notice is"');
    expect(html.match(/<li/g)).toHaveLength(5);
  });
  it('marks only the current step with aria-current="step"', () => {
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
  it('says every state in words, so colour is never alone', () => {
    for (const spoken of ['Done: ', 'Now: ', 'To come: ', 'Done, needs a look: ', 'Declined: ']) expect(html).toContain(spoken);
  });
  it('joins the steps with a line, except after the last', () => {
    expect(html.match(/w-0\.5/g)).toHaveLength(4);
  });
});
