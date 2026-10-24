'use client';

import * as React from 'react';

import { PickShiftButton, ShiftChip, ShiftGrid, ShiftLegend, ShiftSwatchPicker, TwoLineRow, type ShiftGridCell, type ShiftGridRow, type ShiftTone } from '../..';
import { Label, Section } from '../gallery-parts';

const M: ShiftGridCell = { tone: 'morning', label: '06–14' };
const A: ShiftGridCell = { tone: 'afternoon', label: '14–22' };
const L: ShiftGridCell = { tone: 'leave', label: 'Leave' };

const ROWS: ShiftGridRow[] = [
  { id: '1', name: 'Victor Maina', sub: 'Head', cells: [M, M, M, M, M, null, null], hours: '40' },
  { id: '2', name: 'Joy Chebet', sub: 'Also at Highway Sat', subTone: 'warning', cells: [A, A, A, null, A, { ...A, flagged: true }, null], hours: '40' },
  { id: '3', name: 'Mark Njoroge', sub: 'Barista', cells: [A, A, L, M, M, M, null], hours: '40' },
  { id: '4', name: 'Cynthia Wairimu', sub: 'Barista', cells: [null, M, A, A, A, A, null], hours: '40' },
];

/** Shift palette, chips, legend, swatches, the rota grid and the two-line list row. */
export function ScheduleSection() {
  const [swatch, setSwatch] = React.useState<ShiftTone>('earlyBake');
  const [dept, setDept] = React.useState('Barista');
  const [cell, setCell] = React.useState('nothing yet');
  const grid = ROWS.map((r) => ({ ...r, cells: r.cells.map((c) => (c && 'label' in c ? { ...c, onSelect: () => setCell(`${r.name}: ${c.label}`) } : c)) }));
  return (
    <Section id="schedule" title="17 · Shift chips, grid, swatches, two-line row" node="16G6-0 / 16FP-0 / 18XZ-0 / 19AL-0 / 16EK-0" note="The grid is presentational: cells come in as props and a cell is a button only when the screen passes onSelect. Mid-day and Early bake are token approximations (README, token gaps).">
      <div>
        <Label>ShiftChip · five tones, long label, chosen ring, flagged, changed-from · PickShiftButton</Label>
        <div className="flex flex-wrap items-start gap-4 bg-wds-surface p-6">
          <ShiftChip tone="morning" label="06–14" />
          <ShiftChip tone="afternoon" label="14–22" />
          <ShiftChip tone="midday" label="10–18" />
          <ShiftChip tone="earlyBake" label="04–12" />
          <ShiftChip tone="leave" label="Leave" />
          <ShiftChip tone="morning" label="Morning 06:00 to 14:00" long />
          <ShiftChip tone="afternoon" label="14–22" chosen />
          <ShiftChip tone="afternoon" label="14–22" flagged />
          <ShiftChip tone="morning" label="06–14" changedFrom="Afternoon" />
          <ShiftChip tone="morning" label="06–14" onSelect={() => setCell('chip')} />
          <ShiftChip tone="morning" label="06–14" onSelect={() => undefined} disabled />
          <PickShiftButton onClick={() => setCell('pick shift')} />
        </div>
        <p className="mb-0 mt-2 font-mono text-[11px] text-wds-text-secondary">Last pressed: {cell}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label>ShiftLegend</Label>
          <ShiftLegend items={[{ tone: 'morning' }, { tone: 'afternoon' }, { tone: 'midday' }, { tone: 'earlyBake' }, { tone: 'leave' }]} />
        </div>
        <div>
          <Label>ShiftSwatchPicker (arrow keys)</Label>
          <ShiftSwatchPicker value={swatch} onChange={setSwatch} />
        </div>
      </div>
      <div>
        <Label>ShiftGrid · Barista week (scrolls sideways on a phone)</Label>
        <ShiftGrid
          label="Barista rota, 12 to 18 October"
          days={['MON 12', 'TUE 13', 'WED 14', 'THU 15', 'FRI 16', 'SAT 17', 'SUN 18']}
          rows={grid}
          footer={{
            label: 'ON, NEEDS 4',
            cells: [{ text: '4' }, { text: '5' }, { text: '4' }, { text: '5' }, { text: '5' }, { text: '3 thin', tone: 'warning' }, { text: '1', tone: 'faint' }],
          }}
        />
      </div>
      <div className="max-w-[290px] border border-wds-border bg-wds-surface">
        <Label>TwoLineRow</Label>
        <TwoLineRow title="All departments" sub="31 people · 118 shifts" status="3 need a look" statusTone="warning" onSelect={() => setDept('All')} selected={dept === 'All'} />
        <TwoLineRow title="Service" sub="10 people · Head Nancy Wangari" status="Thin Sat" statusTone="warning" onSelect={() => setDept('Service')} selected={dept === 'Service'} />
        <TwoLineRow title="Barista" sub="7 people · Head Victor Maina" status="1 clash" statusTone="warning" onSelect={() => setDept('Barista')} selected={dept === 'Barista'} />
        <TwoLineRow title="Kitchen" sub="9 people · Head Kelvin Kings (on leave)" status="Complete" statusTone="success" onSelect={() => setDept('Kitchen')} selected={dept === 'Kitchen'} />
        <TwoLineRow title="Housekeeping" sub="2 people · No head" status="Not started" statusTone="warning" />
      </div>
    </Section>
  );
}
