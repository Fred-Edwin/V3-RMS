import type { TemplateView } from '../../_shared/types/rota-types';

/**
 * What a key does to the focused cell: a template's letter sets that shift, Delete or Backspace clears the day. Returns the template id,
 * `null` for a day off, or `undefined` when the key means nothing here.
 */
export function cellChangeFor(key: string, templates: readonly TemplateView[]): string | null | undefined {
  if (key === 'Delete' || key === 'Backspace') return null;
  if (key.length !== 1) return undefined;
  return templates.find((t) => t.letter !== null && t.letter.toLowerCase() === key.toLowerCase())?.id;
}
