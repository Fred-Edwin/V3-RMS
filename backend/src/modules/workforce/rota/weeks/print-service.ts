import { addDays, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import type { TemplateView } from '../rota.types';
import { weeksReadService, type WeekRequest } from './weeks-read-service';
import { weeksRepository } from './weeks-repository';

export interface PrintCell {
  /** Keyboard letter, or the first letter of the name. */
  code: string;
  name: string;
  colour: string;
  startTime: string;
  endTime: string;
}

export interface PrintedRota {
  siteName: string;
  weekStart: NairobiDate;
  weekEnd: NairobiDate;
  printedBy: string;
  printedAt: string;
  days: { date: NairobiDate }[];
  /** The shifts used this week, for the colour key. */
  key: TemplateView[];
  departments: {
    id: string | null;
    name: string;
    headName: string | null;
    people: { name: string; positionName: string | null; plannedMinutes: number; days: Record<string, PrintCell[]> }[];
    perDay: Record<string, number>;
  }[];
}

/**
 * The printed rota's data (Chapter 5, step 10): a landscape grid coloured by shift, grouped by department. It is the same
 * grid the screen reads, without cost: a printed page is passed around, so it never carries pay.
 */
export const printService = {
  async get(subject: AccessSubject, request: WeekRequest, now: Date = new Date()): Promise<PrintedRota> {
    const ctx = await resolveActor(subject);
    const view = await weeksReadService.getWeek(subject, request, now, false);
    const templateOf = new Map(view.templates.map((t) => [t.id, t] as const));
    const siteName = (await weeksRepository.siteName(view.siteId)) ?? '';
    return {
      siteName,
      weekStart: view.weekStart,
      weekEnd: addDays(view.weekStart, 6),
      printedBy: ctx.name,
      printedAt: now.toISOString(),
      days: view.days.map((d) => ({ date: d.date })),
      key: view.templates.filter((t) => t.thisWeek > 0),
      departments: view.departments
        .map((department) => {
          const people = view.people.filter((p) => p.departmentId === department.id && Object.keys(p.cells).length > 0);
          return {
            id: department.id,
            name: department.name,
            headName: department.headName,
            people: people.map((p) => ({
              name: p.name,
              positionName: p.positionName,
              plannedMinutes: p.plannedMinutes,
              days: Object.fromEntries(
                Object.entries(p.cells).map(([date, shifts]) => [
                  date,
                  shifts.flatMap((s) => {
                    const t = templateOf.get(s.templateId);
                    return t ? [{ code: t.letter ?? t.name.charAt(0).toUpperCase(), name: t.name, colour: t.colour, startTime: t.startTime, endTime: t.endTime }] : [];
                  }),
                ]),
              ),
            })),
            perDay: Object.fromEntries(view.days.map((d) => [d.date, people.filter((p) => (p.cells[d.date] ?? []).length > 0).length])),
          };
        })
        .filter((d) => d.people.length > 0),
    };
  },
};
