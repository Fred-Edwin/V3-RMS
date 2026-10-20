import type { ConductAbout, ConductLevel } from './conduct-model';

/** One late or absent day copied from the timesheets onto the notice. Times are Nairobi "HH:MM". */
export interface FactDay {
  date: string; // YYYY-MM-DD
  plannedIn: string | null;
  clockIn: string | null;
  minutesLate: number;
  excused: boolean;
}

/** The facts attached to a Lateness or Absence notice, frozen at issue (the letter's "attached" table is page 2). */
export interface FactsSnapshot {
  kind: 'LATENESS' | 'ABSENCE';
  monthKey: string; // YYYY-MM
  count: number;
  minutes: number;
  days: FactDay[]; // the unexcused days only
}

/** Everything a letter needs, frozen at issue: a later Rules, wording or name change never alters an issued letter (D29). */
export interface LetterSnapshot {
  letterVersion: string;
  level: Exclude<ConductLevel, 'VERBAL_NOTE'>;
  about: ConductAbout;
  subject: string; // "Written warning: late arrival for work"
  salutation: string; // "Dear Mark,"
  paragraphs: string[];
  closing: string;
  issuedAtLong: string;
  validUntilLong: string;
  appealByLong: string | null;
  reducedFromFinal: boolean;
  person: { name: string; role: string; siteName: string };
  issuer: { name: string; role: string };
}
