import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PersonRadioList } from './person-radio-list';

const people = [
  { value: 'a', name: 'Grace Wairimu', line: 'Housekeeper · since Mar 2025 · has a login', marker: 'Recommended' },
  { value: 'b', name: 'Samuel Kiptoo', line: 'Housekeeper · since Aug 2025 · has a login' },
];
const draw = (value: string | null, disabled = false): string =>
  renderToStaticMarkup(createElement(PersonRadioList, { legend: 'WHO SHOULD LEAD IT', people, value, onChange: () => undefined, disabled }));

describe('PersonRadioList', () => {
  it('draws one real radio per person in one group, with the chosen one checked and the marker shown', () => {
    const html = draw('a');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('Recommended');
    expect(html).toContain('<legend');
    expect(new Set(html.match(/name="([^"]+)"/g)).size).toBe(1);
  });

  it('disables the group while a save is running and checks nobody when nothing is chosen', () => {
    const html = draw(null, true);
    expect(html).toContain('<fieldset');
    expect(html).toContain('disabled=""');
    expect(html.match(/checked=""/g)).toBeNull();
  });
});
