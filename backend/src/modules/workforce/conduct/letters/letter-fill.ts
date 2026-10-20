import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { LEVEL_LABELS, type ConductAbout, type ConductLevel } from '../_shared/conduct-model';
import type { FactsSnapshot, LetterSnapshot } from '../_shared/conduct-snapshots';
import { ABOUT_PHRASES, LETTER_TEXT, LETTER_VERSION, SUBJECT_ABOUT } from './conduct-letters';
import { datesLong, fillBlanks, firstNameOf, longDate, longDateOf, monthYear, plainText } from './letter-text';

export interface LetterInput {
  level: Exclude<ConductLevel, 'VERBAL_NOTE'>;
  about: ConductAbout;
  personName: string;
  personRole: string;
  siteName: string;
  issuerName: string;
  issuerRole: string;
  facts: FactsSnapshot | null;
  ownLine: string;
  issuedAt: Date;
  validUntil: NairobiDate;
  appealDays: number;
  appealBy: Date | null; // null: a reduced notice, which gives no new appeal
  reducedFromFinalAt: Date | null; // set for a Written notice made by reducing a Final one
}

/**
 * Builds the frozen text of a letter from the fixed wording (C4). The own line is plain text, never markup. A Lateness or Absence
 * letter with facts leads with the facts paragraph; other categories lead with "about {phrase}".
 */
export function buildLetter(input: LetterInput): LetterSnapshot {
  const final = input.level === 'FINAL_WRITTEN_WARNING';
  const intro = final ? LETTER_TEXT.finalIntro : LETTER_TEXT.writtenIntro;
  const decidedAtLong = input.reducedFromFinalAt ? longDateOf(input.reducedFromFinalAt) : '';
  const blanks = {
    validUntilLong: longDate(input.validUntil),
    appealByLong: input.appealBy ? longDateOf(input.appealBy) : '',
    appealDays: input.appealDays,
    aboutPhrase: ABOUT_PHRASES[input.about],
    decidedAtLong,
  };

  const paragraphs: string[] = [];
  const facts = input.facts;
  if (facts) {
    const template = facts.kind === 'LATENESS' ? LETTER_TEXT.lateness : LETTER_TEXT.absence;
    paragraphs.push(
      `${intro} ${fillBlanks(template, {
        count: facts.count,
        monthYear: monthYear(facts.monthKey),
        datesLong: datesLong(facts.days.map((day) => day.date as NairobiDate)),
        minutes: facts.minutes,
      })}`,
    );
  } else {
    paragraphs.push(fillBlanks(final ? LETTER_TEXT.finalOther : LETTER_TEXT.writtenOther, blanks));
  }
  const follow = final ? LETTER_TEXT.finalFollow : LETTER_TEXT.writtenFollow;
  paragraphs.push(`${plainText(input.ownLine)} ${follow}`);
  if (input.reducedFromFinalAt) paragraphs.push(fillBlanks(LETTER_TEXT.reduced, blanks));
  paragraphs.push(fillBlanks(input.appealBy ? LETTER_TEXT.ending : LETTER_TEXT.endingNoAppeal, blanks));

  return {
    letterVersion: LETTER_VERSION,
    level: input.level,
    about: input.about,
    subject: `${LEVEL_LABELS[input.level]}: ${SUBJECT_ABOUT[input.about]}`,
    salutation: `Dear ${firstNameOf(input.personName)},`,
    paragraphs,
    closing: LETTER_TEXT.closing,
    issuedAtLong: longDateOf(input.issuedAt),
    validUntilLong: blanks.validUntilLong,
    appealByLong: input.appealBy ? blanks.appealByLong : null,
    reducedFromFinal: input.reducedFromFinalAt !== null,
    person: { name: input.personName, role: input.personRole, siteName: input.siteName },
    issuer: { name: input.issuerName, role: input.issuerRole },
  };
}

/** The record line for a verbal note, shown in the staff list, the file and to its readers (there is no letter). */
export const verbalNoteLine = (issuedAt: Date, issuerRole: string, ownLine: string): string =>
  fillBlanks(LETTER_TEXT.verbalLine, { issuedAtLong: longDateOf(issuedAt), issuerRole, ownLine: plainText(ownLine) });
