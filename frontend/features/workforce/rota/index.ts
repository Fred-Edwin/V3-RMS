/**
 * Workforce Rota (slice 2): the public API. Route shells import the screens from here; the Home cards import the data hooks. Nothing
 * deeper is imported from outside this folder. See README.md.
 */
export { RotaScreen } from './grid/components/rota-screen';
export { TemplatesScreen } from './templates/components/templates-screen';
export { PrintRoute } from './print/components/print-route';
export { useMyShifts } from './_shared/hooks/use-rota-data';
export { weekPlan, type WeekPlanDay } from './_shared/lib/my-week';
export { addDays, mondayOf, nairobiToday } from './_shared/lib/rota-dates';
export { toneOfColour } from './_shared/lib/shift-look';
// Rules (1B): the Week and breaks tab lists the shift templates' unpaid breaks, read only.
export { rotaReads } from './_shared/services/rota-services';
export type { TemplateView } from './_shared/types/rota-types';
