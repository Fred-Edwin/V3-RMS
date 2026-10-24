'use client';

import * as React from 'react';

import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { AvatarCell, NeedsYouLine, NumberCell, StatusText, WorkforceTag } from '../..';
import { Label, Section } from '../gallery-parts';

interface Person {
  id: string;
  name: string;
  role: string;
  place: string;
  hours: string;
  state: 'complete' | 'needs';
}

const PEOPLE: Person[] = [
  { id: '1', name: 'Brian Otieno', role: 'Waiter', place: 'Nyeri Town · Service', hours: '41 h 05', state: 'complete' },
  { id: '2', name: 'Joy Chebet', role: 'Barista', place: 'Nyeri Town · Bar', hours: '38 h 30', state: 'needs' },
  { id: '3', name: 'Amina Hassan', role: 'Barista', place: 'Nyeri Town · Bar', hours: '40 h 00', state: 'complete' },
  { id: '4', name: 'Peter Karanja', role: 'Kitchen hand', place: 'Nyeri Town · Kitchen', hours: '44 h 15', state: 'complete' },
];

const COLUMNS: TableColumn<Person>[] = [
  { id: 'who', header: 'EMPLOYEE', width: '280px', cell: (r) => <AvatarCell name={r.name} sub={r.role} /> },
  { id: 'place', header: 'SITE · DEPARTMENT', width: '220px', cell: (r) => <span className="text-[13px] text-wds-text-ink">{r.place}</span> },
  {
    id: 'file',
    header: 'FILE',
    cell: (r) => (r.state === 'complete' ? <WorkforceTag tag="complete" /> : <WorkforceTag tag="needsFinishing" />),
  },
  { id: 'hours', header: 'HOURS', align: 'right', cell: (r) => <NumberCell>{r.hours}</NumberCell> },
];

/** The Workforce look on `ui2/table`: the live data table (search, chips, pager) and a static compact table with a chosen row. */
export function TableSection() {
  const [chosen, setChosen] = React.useState('2');
  return (
    <Section id="table" title="14 · Table, Workforce look" node="R3F-0 / R3L-0 / 18BH-0 / 1O9D-0" note="The existing data table with search, filter chips, the numbered pager and URL state, drawn with the Workforce look: 36 px header in 11 px mono grey over an ink rule, 56 px rows (42 px compact), neutral-200 between rows, and a chosen row with a 3 px caramel bar and a warm fill. Other tables are unchanged.">
      <div>
        <Label>DataTable · tableLook=&quot;workforce&quot; (56 px rows)</Label>
        <DataTable<Person>
          label="People"
          columns={COLUMNS}
          getRowId={(r) => r.id}
          searchParam="gq"
          searchPlaceholder="Search people"
          tableLook="workforce"
          copy={{ emptyTitle: 'No people yet', emptyDescription: 'Add the first person.', filteredEmptyTitle: 'Nobody matches', filteredEmptyDescription: 'Try fewer filters.', errorTitle: 'Could not load people' }}
          fetchRows={async (q) => {
            const term = q.search.toLowerCase();
            const rows = PEOPLE.filter((p) => p.name.toLowerCase().includes(term));
            return { rows, total: rows.length };
          }}
        />
      </div>
      <div>
        <Label>Table look=&quot;workforce&quot; · compact 42 px rows · chosen row, status words, needs-you line</Label>
        <Table look="workforce" aria-label="Timesheets example">
          <TableHeader>
            <TableRow className="h-9 hover:bg-transparent">
              <TableHead>PERSON</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead className="text-right">HOURS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PEOPLE.map((p) => (
              <TableRow key={p.id} size="compact" data-state={chosen === p.id ? 'selected' : undefined} tabIndex={0} onClick={() => setChosen(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChosen(p.id); } }} className="cursor-pointer outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[13px] text-wds-text-ink">{p.name}</span>
                    {p.state === 'needs' ? <NeedsYouLine>Clocked out late, needs you</NeedsYouLine> : null}
                  </div>
                </TableCell>
                <TableCell>{p.state === 'needs' ? <StatusText tone="warning">Waiting</StatusText> : <StatusText tone="success">Approved</StatusText>}</TableCell>
                <TableCell className="text-right">
                  <NumberCell>{p.hours}</NumberCell>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
