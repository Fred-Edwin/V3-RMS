import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { AvatarCell, NeedsYouLine, NumberCell, StatusText } from '../people/table-cells';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);

const sample = (look?: 'workforce', size?: 'compact') =>
  html(
    h(
      Table,
      { look },
      h(TableHeader, null, h(TableRow, null, h(TableHead, null, 'A'))),
      h(TableBody, null, h(TableRow, { size }, h(TableCell, null, 'x')))
    )
  );

describe('Workforce table look', () => {
  it('leaves the existing look untouched unless asked', () => {
    const out = sample();
    expect(out).toContain('h-[46px]');
    expect(out).toContain('h-[34px]');
    expect(out).not.toContain('h-14');
  });
  it('draws a 36 px header and 56 px rows, or 42 px when compact', () => {
    expect(sample('workforce')).toContain('h-9');
    expect(sample('workforce')).toContain('h-14');
    expect(sample('workforce', 'compact')).toContain('h-[42px]');
  });
});

describe('table cells', () => {
  it('shows the avatar, a 500 name and a grey second line', () => {
    const out = html(h(AvatarCell, { name: 'Brian Otieno', sub: 'Waiter' }));
    expect(out).toContain('Brian Otieno');
    expect(out).toContain('font-medium');
    expect(out).toContain('Waiter');
  });
  it('right-aligns numbers in mono', () => {
    expect(html(h(NumberCell, null, '41 h 05'))).toContain('font-wds-mono');
  });
  it('colours status words and marks a needs-you line', () => {
    expect(html(h(StatusText, { tone: 'success', children: 'Approved' }))).toContain('text-wds-success-fg');
    expect(html(h(NeedsYouLine, null, 'Needs you'))).toContain('text-wds-warning-fg');
  });
});
