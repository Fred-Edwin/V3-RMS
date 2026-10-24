import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DIALOG_LEADS, NEXT_STEP_LINES, PURPOSE_LINES, PURPOSE_ROUTES } from './page-copy';

const FRONTEND = join(__dirname, '..', '..', '..', '..', '..'); // frontend/
const MAX_PURPOSE = 90;
/** The old name for Shifts, the build word, the Leave placeholder, and the pronouns the owner does not want guessed. */
const BANNED = /\b(rota|rotas|slice|arrives with|he|she|her|his)\b/i;

const pageFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? pageFiles(full) : name === 'page.tsx' ? [full] : [];
  });

const routeOf = (file: string): string => '/' + relative(join(FRONTEND, 'app'), file).split(sep).slice(0, -1).join('/');

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [readFileSync(full, 'utf8')] : [];
  });

describe('page copy: one purpose line per page', () => {
  it('has a line for every Schedule page that exists, and every listed route is a real page', () => {
    const roots = ['schedule', 'today', 'attendance', 'my-time'].map((p) => join(FRONTEND, 'app', 'app', 'workforce', p));
    const real = roots.flatMap((root) => pageFiles(root)).map(routeOf).sort();
    expect([...PURPOSE_ROUTES].sort()).toEqual(real);
    for (const route of PURPOSE_ROUTES) expect(PURPOSE_LINES[route], `${route} has a line`).toBeTruthy();
  });

  it('keeps every line to 90 characters and one plain sentence pair', () => {
    for (const [route, line] of Object.entries(PURPOSE_LINES)) {
      expect(line.length, `${route}: ${line.length} characters`).toBeLessThanOrEqual(MAX_PURPOSE);
      expect(line.endsWith('.'), `${route} ends with a full stop`).toBe(true);
    }
  });

  it('uses no banned word anywhere in the file', () => {
    const everything = [
      ...Object.values(PURPOSE_LINES),
      ...Object.values(NEXT_STEP_LINES),
      DIALOG_LEADS.copyWeek('26 Oct', '2 Nov', 'Barista'),
      DIALOG_LEADS.copyWeek('26 Oct', '2 Nov', null),
      DIALOG_LEADS.copyDay('Barista'),
      DIALOG_LEADS.nearTerm,
      DIALOG_LEADS.leaveOverride('Tue 27'),
      DIALOG_LEADS.template,
      DIALOG_LEADS.templateEdit,
      DIALOG_LEADS.switchOn('Nyeri Town'),
      DIALOG_LEADS.switchOff('Nyeri Town'),
      DIALOG_LEADS.editTime('Amina Hassan'),
      DIALOG_LEADS.clockFor('Amina Hassan'),
    ];
    for (const line of everything) expect(BANNED.test(line), line).toBe(false);
  });

  it('opens each dialog with what will happen', () => {
    const leads = [DIALOG_LEADS.copyWeek('26 Oct', '2 Nov', null), DIALOG_LEADS.copyDay('Barista'), DIALOG_LEADS.nearTerm, DIALOG_LEADS.leaveOverride('Tue 27'), DIALOG_LEADS.template, DIALOG_LEADS.templateEdit, DIALOG_LEADS.switchOn('Nyeri Town'), DIALOG_LEADS.switchOff('Nyeri Town'), DIALOG_LEADS.editTime('Amina'), DIALOG_LEADS.clockFor('Amina')];
    for (const lead of leads) expect(lead.startsWith('This '), lead).toBe(true);
    expect(DIALOG_LEADS.copyWeek('26 Oct', '2 Nov', 'Barista')).toContain('Nothing is overwritten');
  });

  it('empty and error lines name the next step', () => {
    expect(NEXT_STEP_LINES.noShiftsYet).toMatch(/Click a day|Start from last week/);
    expect(NEXT_STEP_LINES.noOneToday).toMatch(/Add one from Shifts/);
    expect(NEXT_STEP_LINES.couldNotLoad).toMatch(/Try again/);
  });

  it('is wired: every page draws its line from this file, and none writes its own', () => {
    const code = sources(join(FRONTEND, 'features', 'workforce')).join('\n');
    for (const route of PURPOSE_ROUTES) expect(code, `${route} is drawn with purposeOf`).toContain(`purposeOf('${route}')`);
  });
});
