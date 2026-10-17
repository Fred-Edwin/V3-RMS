import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InboxRow } from './inbox-row';
import { KeyValueRows } from './key-value-rows';
import { CodeBoxes, PinField } from './pin-field';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('PinField', () => {
  it('draws one field with four dots, not four boxes', () => {
    const out = html(h(PinField, { value: '12', onChange: noop, label: 'Your PIN' }));
    expect(out.match(/•/g)).toHaveLength(4);
    expect(out).toContain('border-wds-text-ink');
    expect(out).not.toContain('w-11');
  });
  it('turns the border red when invalid', () => {
    expect(html(h(PinField, { value: '', onChange: noop, label: 'Your PIN', invalid: true }))).toContain('border-wds-error-fg');
  });
});

describe('CodeBoxes', () => {
  it('draws four separate boxes, red when the code is wrong', () => {
    const out = html(h(CodeBoxes, { value: '1234', onChange: noop, label: 'Code', invalid: true }));
    expect(out.match(/w-11/g)).toHaveLength(4);
    expect(out.match(/border-wds-error-fg/g)).toHaveLength(4);
  });
});

describe('KeyValueRows', () => {
  it('puts the label left and a mono value right, with an ink rule on top', () => {
    const out = html(h(KeyValueRows, { rows: [{ label: 'Net to pay', value: 'KES 3,168,500', mono: true }] }));
    expect(out).toContain('border-t border-wds-text-ink');
    expect(out).toContain('font-wds-mono');
    expect(out).toContain('Net to pay');
  });
  it('shows the old value struck out before the new one', () => {
    const out = html(h(KeyValueRows, { rows: [{ label: 'Basic pay', value: '42,000', from: '38,000' }] }));
    expect(out).toContain('line-through');
    expect(out.indexOf('38,000')).toBeLessThan(out.indexOf('42,000'));
  });
});

describe('InboxRow action', () => {
  const row = (emphasis?: 'primary' | 'outlined') =>
    html(h(InboxRow, { areaKind: 'ROTA', kind: 'information', when: '1 h', title: 'T', action: { label: 'Open', onClick: noop, emphasis } }));
  it('is outlined by default and brown only when asked', () => {
    expect(row()).toContain('border-wds-border-strong');
    expect(row()).not.toContain('bg-wds-primary ');
    expect(row('primary')).toContain('bg-wds-primary');
  });
});
