import { describe, expect, it } from 'vitest';
import type { LogRow } from './audit-rows';
import { CSV_BOM, CSV_HEADER, csvField, csvLine, csvRow, exportFilename, whenOf } from './csv';

describe('csv escaping (A4)', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('%j gets a leading quote so it cannot run as a formula', (value) => {
    expect(csvField(value).replace(/^"/, '')).toMatch(/^'/);
  });

  it('wraps commas, quotes and line breaks and doubles the quotes', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });

  it('leaves plain text alone', () => {
    expect(csvField('Rule changed')).toBe('Rule changed');
  });

  it('a hostile reason is both quoted and wrapped', () => {
    expect(csvField('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });
});

describe('the file', () => {
  const row: LogRow = {
    id: 'e1', seq: '4182', occurredAt: '2026-10-19T11:05:00.000Z', actor: { id: 'u', name: 'Anne Muthoni', role: 'ACCOUNTANT' }, channel: 'APP', area: 'WORKFORCE', event: 'pay',
    action: 'payroll.approved', title: 'Payroll approved', detail: 'Month 2026-09', subject: { type: 'PayrollMonth', id: 'm', label: 'PAY-2026-09' }, subjectUser: null, siteId: null, siteName: null,
    flagged: true, reason: null, deviceLabel: 'Android', placeLabel: 'Nyeri',
  };

  it('has the columns of Paper and the Nairobi time, and carries no device, place or hash', () => {
    expect(CSV_HEADER).toEqual(['When', 'Who', 'Role', 'Area', 'Event', 'What', 'Detail', 'Site', 'Reason', 'Entry number', 'Flagged']);
    expect(whenOf(row.occurredAt)).toBe('2026-10-19 14:05');
    const line = csvRow(row);
    expect(line).toBe('2026-10-19 14:05,Anne Muthoni,ACCOUNTANT,WORKFORCE,pay,Payroll approved,Month 2026-09,,,4182,Yes\r\n');
    expect(line).not.toMatch(/Android|Nyeri/);
  });

  it('starts with the byte order mark and names the file by the range', () => {
    expect(CSV_BOM + csvLine(CSV_HEADER)).toMatch(/^﻿When,Who/);
    expect(exportFilename('2026-09-20', '2026-10-19')).toBe('Audit-log-2026-09-20-to-2026-10-19.csv');
  });
});
