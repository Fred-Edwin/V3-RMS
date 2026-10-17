import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { onHover } from '../lib/interaction';
import { CompletenessRing, ProbationBar } from './completeness-ring';
import { FilterChip } from './filter-chip';
import { InboxRow } from './inbox-row';
import { WorkforceKpiStrip } from './kpi-strip';
import { AvatarStack, PersonAvatar, PresenceDot } from './person-avatar';
import { ComingUpTimeline, LifeTimeline } from './timeline';
import { ChangeSummary, OldToNew } from './change-dialog';
import { EmptyState, ErrorBlock, OfflineStrip, SavedOnPhoneMarker } from './states';
import { StatusTag, WorkforceTag } from './status-tag';
import { ListRow } from './list-detail-layout';
import { FileSoFarPanel, StepRail } from './wizard-layout';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;

describe('behaviour rules', () => {
  it('hover only applies on devices that can hover', () => {
    expect(onHover('bg-wds-neutral-50')).toBe('[@media(hover:hover)_and_(pointer:fine)]:hover:bg-wds-neutral-50');
  });
});

describe('KPI strip', () => {
  const cells = [
    { key: 'a', label: 'PEOPLE ON FILE', value: '89', detail: '77 active, 12 exited' },
    { key: 'b', label: 'NEEDS FINISHING', value: '3', detail: 'bank, contract or photo missing', actionable: true, onSelect: noop },
  ];
  it('shows an arrow, a warning edge and a button only on an actionable cell', () => {
    const out = html(h(WorkforceKpiStrip, { cells }));
    expect(out).toContain('NEEDS FINISHING');
    expect(out.match(/→/g)).toHaveLength(1);
    expect(out).toContain('border-t-wds-warning-fg');
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).toContain('text-[30px]');
  });
});

describe('status tags', () => {
  it('keeps colour and words in one place', () => {
    expect(html(h(WorkforceTag, { tag: 'complete' }))).toContain('text-wds-success-fg');
    expect(html(h(WorkforceTag, { tag: 'bankMissing' }))).toContain('Bank details missing');
    expect(html(h(WorkforceTag, { tag: 'probationEnds', label: 'Probation ends 14 Oct' }))).toContain('Probation ends 14 Oct');
    expect(html(h(WorkforceTag, { tag: 'monthly' }))).toContain('border-wds-border-strong');
  });
  it('a checklist mark is also read out in words', () => {
    const out = html(h(StatusTag, { tone: 'success', size: 'header', mark: 'done' }, 'Identity'));
    expect(out).toContain('✓');
    expect(out).toContain('Done: ');
  });
});

describe('filter chip', () => {
  it('is a toggle that says whether it is chosen, and shows its count', () => {
    const on = html(h(FilterChip, { label: 'All', count: 89, selected: true }));
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('>89<');
    expect(html(h(FilterChip, { label: 'Exited', count: 12 }))).toContain('aria-pressed="false"');
  });
  it('a disabled chip tells the reason', () => {
    const out = html(h(FilterChip, { label: 'Casual pool', disabled: true, disabledReason: 'No casuals at this site' }));
    expect(out).toContain('disabled=""');
    expect(out).toContain('No casuals at this site');
  });
});

describe('avatar', () => {
  it('shows initials and a name for screen readers', () => {
    const out = html(h(PersonAvatar, { name: 'Joy Chebet' }));
    expect(out).toContain('aria-label="Joy Chebet"');
    expect(out).toContain('>JC<');
  });
  it('with presence it says so in words', () => {
    expect(html(h(PersonAvatar, { name: 'Joy Chebet', presence: 'late' }))).toContain('aria-label="Joy Chebet, Late"');
  });
  it('a photo replaces the initials', () => {
    const out = html(h(PersonAvatar, { name: 'Joy Chebet', photoUrl: 'https://example.test/a.jpg' }));
    expect(out).toContain('<img');
    expect(out).not.toContain('>JC<');
  });
  it('a stack counts the rest and the dot has its words', () => {
    const out = html(h(AvatarStack, { names: ['A B', 'C D', 'E F', 'G H', 'I J', 'K L', 'M N'], max: 5 }));
    expect(out).toContain('+2');
    expect(html(h(PresenceDot, { presence: 'on' }))).toContain('ON SHIFT');
  });
});

describe('completeness ring and probation bar', () => {
  it('draws the percent, and a tick instead of it at 100', () => {
    const part = html(h(CompletenessRing, { percent: 67 }));
    expect(part).toContain('67%');
    expect(part).toContain('aria-label="File 67 percent complete"');
    const full = html(h(CompletenessRing, { percent: 100 }));
    expect(full).toContain('aria-label="File complete"');
    expect(full).not.toContain('100%');
    expect(full).toContain('M5 12.5l4.5 4.5L19 7.5');
  });
  it('probation bar says the days in words and uses the right fill', () => {
    const amber = html(h(ProbationBar, { dayNumber: 80, totalDays: 90 }));
    expect(amber).toContain('aria-valuetext="Day 80 of 90, 10 days left"');
    expect(amber).toContain('bg-wds-caramel-500');
    expect(html(h(ProbationBar, { dayNumber: 85, totalDays: 90 }))).toContain('bg-wds-error-fg');
    expect(html(h(ProbationBar, { dayNumber: 10, totalDays: 90 }))).toContain('bg-wds-success-fg');
  });
});

describe('timelines', () => {
  it('Life at Wendo is an ordered list with a dashed future dot', () => {
    const out = html(
      h(LifeTimeline, {
        events: [
          { key: '1', date: '14 JUL', text: 'Hired as Barista, probation began' },
          { key: '2', date: '14 OCT', text: 'Probation decision', state: 'future' },
        ],
      })
    );
    expect(out).toContain('<ol');
    expect(out).toContain('border-dashed');
    expect(out).toContain('(still to come)');
  });
  it('Coming up joins items with a line and ends the line at the last one', () => {
    const out = html(
      h(ComingUpTimeline, {
        events: [
          { key: '1', date: '12 OCT', text: 'Faith Njeri starts leave' },
          { key: '2', date: '30 OCT', text: 'Payday', tone: 'good' },
        ],
      })
    );
    expect(out).toContain('bg-wds-success-fg');
    expect(out).toContain('bg-transparent');
  });
});

describe('layouts', () => {
  it('a chosen list row has the caramel bar and aria-current', () => {
    const out = html(h(ListRow, { selected: true, onSelect: noop, children: 'Brian Otieno' }));
    expect(out).toContain('aria-current="true"');
    expect(out).toContain('bg-wds-caramel-600');
    expect(out).toContain('opacity-100');
  });
  it('the step rail marks the current step and reads states aloud', () => {
    const out = html(
      h(StepRail, {
        title: 'NEW EMPLOYEE',
        steps: [
          { key: 'who', label: 'Who', state: 'done' },
          { key: 'job', label: 'Job', state: 'current' },
          { key: 'pay', label: 'Pay', state: 'upcoming' },
        ],
      })
    );
    expect(out).toContain('aria-current="step"');
    expect(out).toContain('(done)');
    expect(out).toContain('(current step)');
  });
  it('the file so far lists each part with its state', () => {
    const out = html(
      h(FileSoFarPanel, {
        title: 'THE FILE SO FAR',
        percent: 20,
        note: 'She can be rostered once Who and Job are done.',
        rows: [{ key: 'who', label: 'Who', value: 'In progress', tone: 'progress' }],
      })
    );
    expect(out).toContain('20%');
    expect(out).toContain('In progress');
  });
});

describe('change dialog parts', () => {
  it('the summary box lists each effect', () => {
    const out = html(h(ChangeSummary, { caption: 'WHAT CHANGES WHEN GRACE BECOMES HEAD', lines: ['One.', 'Two.'] }));
    expect(out.match(/<li/g)).toHaveLength(2);
  });
  it('old to new reads as a sentence for a screen reader', () => {
    const out = html(h(OldToNew, { label: 'Basic pay', from: 'KES 38,000', to: 'KES 42,000' }));
    expect(out).toContain('KES 38,000');
    expect(out).toContain(' to ');
  });
});

describe('states kit', () => {
  it('an error replaces only its part, with a reference and Try again', () => {
    const out = html(h(ErrorBlock, { title: 'We could not load the rota.', line: 'Nothing was changed.', reference: '1a2b', onRetry: noop }));
    expect(out).toContain('role="alert"');
    expect(out).toContain('Reference WF-1A2B');
    expect(out).toContain('Try again');
    expect(out).toContain('border-t-wds-error-fg');
  });
  it('empty has no action unless the screen passes one (hidden, never greyed)', () => {
    expect(html(h(EmptyState, { kind: 'nothingYet', title: 'No rota yet' }))).not.toContain('<button');
    expect(html(h(EmptyState, { kind: 'nothingFound', title: 'No match', action: { label: 'Clear the filter', onClick: noop } }))).toContain('Clear the filter');
  });
  it('offline strip and saved marker carry their words', () => {
    expect(html(h(OfflineStrip, { stillWorks: 'Clock events still work.' }))).toContain('No signal. Clock events still work.');
    expect(html(h(SavedOnPhoneMarker, { what: 'Clock-in at 06:04' }))).toContain('SAVED ON THIS PHONE');
  });
});

describe('inbox row', () => {
  it('shows the five parts and colours the bar by kind', () => {
    const out = html(
      h(InboxRow, {
        areaKind: 'ROTA CHANGE',
        kind: 'changed',
        when: '3 min',
        title: 'Sat 17 changed: day off is now Morning',
        whoAndWhy: 'Changed by Faith Njeri. Reason: cover for a gap.',
        action: { label: 'See my rota', onClick: noop },
      })
    );
    expect(out).toContain('ROTA CHANGE');
    expect(out).toContain('3 min');
    expect(out).toContain('border-l-wds-caramel-600');
    expect(out).toContain('See my rota');
    expect(html(h(InboxRow, { areaKind: 'PAYSLIP', kind: 'problem', when: 'now', title: 'x' }))).toContain('border-l-wds-error-fg');
  });
});
