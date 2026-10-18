import type { ImpactLine } from '../types/people-types';

/** A line from a later slice's impact ("5 shifts removed"): the code in words until that slice writes its own sentence. */
export function impactText(line: ImpactLine): string {
  const words = line.code.toLowerCase().replace(/_/g, ' ');
  return line.count === null ? words : `${line.count} ${words}`;
}
