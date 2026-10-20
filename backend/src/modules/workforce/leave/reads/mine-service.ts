import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { summaryOf, type ApplicationSummary } from '../applications/application-summary';
import { balancesOf, type RequestableType } from '../balances/balance-service';
import { applicationsRepository } from '../data/applications-repository';
import { peopleRepository } from '../data/people-repository';
import { leaveYearOf } from '../engine/leave-days';
import { spokenLabel } from '../leave-words';
import type { TypeBalance } from '../leave.types';
import { slipCode } from '../slip/slip-snapshot';
import type { z } from 'zod';
import type { mineQuery } from '../leave-validators';

export interface MyOverview {
  year: number;
  /** Casual workers (probation, no contract) have no leave until their contract starts: an empty, well-formed answer, never an error. */
  casual: boolean;
  /** False for a login with no employee file. */
  onPolicy: boolean;
  message: string | null;
  headline: { typeCode: string; left: number } | null;
  waiting: { count: number; oldest: ApplicationSummary | null } | null;
  cards: (TypeBalance & { spoken: string })[];
  chips: RequestableType[];
}

const empty = (year: number, casual: boolean, onPolicy: boolean, message: string): MyOverview => ({ year, casual, onPolicy, message, headline: null, waiting: null, cards: [], chips: [] });

/** M1: the cards per entitled type, what is waiting, and the types that can be asked for. */
export async function myOverview(subject: AccessSubject, yearAsked?: number, now: Date = new Date()): Promise<MyOverview> {
  const year = yearAsked ?? leaveYearOf(nairobiToday(now));
  const person = await peopleRepository.byUserId(subject.id);
  if (!person) return empty(year, false, false, 'You are not on the leave policy yet. Ask HR.');
  if (person.isCasual) return empty(year, true, true, 'Leave starts when your contract starts.');
  const balances = await balancesOf(person, year, now);
  const { rows, total } = await applicationsRepository.page({ companyId: person.companyId, employeeId: person.id, statuses: ['WAITING'] }, 0, 50);
  const oldest = [...rows].sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime())[0];
  const lead = balances.cards.find((card) => card.typeCode === 'ANNUAL') ?? balances.cards[0];
  return {
    year, casual: false, onPolicy: true, message: null,
    headline: lead ? { typeCode: lead.typeCode, left: lead.left } : null,
    waiting: total > 0 && oldest ? { count: total, oldest: summaryOf(oldest, now) } : null,
    cards: balances.cards.map((card) => ({ ...card, spoken: spokenLabel(card) })),
    chips: balances.requestable,
  };
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type MyRow = ApplicationSummary & { slipCode: string | null };

/** M2: the person's own requests, newest ask first. A casual or a login with no file gets an empty page. */
export async function myApplications(subject: AccessSubject, query: z.infer<typeof mineQuery>, now: Date = new Date()): Promise<Page<MyRow>> {
  const person = await peopleRepository.byUserId(subject.id);
  if (!person) return { rows: [], total: 0, page: query.page, pageSize: query.rows };
  const { rows, total } = await applicationsRepository.page(
    { companyId: person.companyId, employeeId: person.id, ...(query.status ? { statuses: query.status } : {}), ...(query.type ? { typeCode: query.type } : {}), ...(query.year ? { year: query.year } : {}) },
    (query.page - 1) * query.rows,
    query.rows,
  );
  return { rows: rows.map((row) => ({ ...summaryOf(row, now), slipCode: row.slipNumber === null ? null : slipCode(row.slipNumber) })), total, page: query.page, pageSize: query.rows };
}
