import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChangedBySomeoneElseCard, FaultCard, NotInYourMenuCard } from './message-cards';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('the three desktop messages', () => {
  const changed = (extra: { onUseMine?: () => void } = {}) =>
    h(ChangedBySomeoneElseCard, {
      by: 'Faith Njeri, Branch Manager',
      when: 'Mon 19 Oct 14:02',
      cell: 'Mon 19 Oct, Brian Otieno',
      theirs: 'The Branch Manager set: Afternoon 14:00 to 22:00',
      yours: 'You tried: Morning 06:00 to 14:00',
      onKeepTheirs: noop,
      ...extra,
    });

  it('the conflict card is a blocking dialog that says nothing was overwritten, and offers both choices only where one cell conflicts', () => {
    const both = html(changed({ onUseMine: noop }));
    expect(both).toContain('role="alertdialog"');
    expect(both).toContain('CHANGED BY SOMEONE ELSE FIRST');
    expect(both).toContain('nothing was overwritten');
    expect(both).toContain('Keep theirs');
    expect(both).toContain('Use mine instead');
    const only = html(changed());
    expect(only).toContain('Keep theirs');
    expect(only).not.toContain('Use mine instead');
  });

  it('the not-in-your-menu card changes nothing and sends the person Home', () => {
    const out = html(h(NotInYourMenuCard, { onHome: noop }));
    expect(out).toContain('NOT IN YOUR MENU');
    expect(out).toContain('This page is not part of your work here');
    expect(out).toContain('Nothing was changed');
    expect(out).toContain('Go to Home');
  });

  it('the fault card shows the reference and offers Copy reference and Try again', () => {
    const out = html(h(FaultCard, { reference: '7q4k', when: '19 Oct 14:22', onRetry: noop, onCopy: noop }));
    expect(out).toContain('A FAULT ON OUR SIDE');
    expect(out).toContain('Reference WF-7Q4K');
    expect(out).toContain('Copy reference');
    expect(out).toContain('Try again');
    expect(out).toContain('border-t-[3px]');
  });

  it('the fault card shows no reference box when the server sent none', () => {
    const out = html(h(FaultCard, { reference: null, when: '19 Oct 14:22', onRetry: noop }));
    expect(out).not.toContain('Reference WF-');
    expect(out).not.toContain('Copy reference');
  });
});
