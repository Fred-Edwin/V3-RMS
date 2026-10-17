import * as React from 'react';

import { ChoicesSection } from './section-choices';
import { PagesSection } from './section-pages';
import { SecretsSection } from './section-secrets';
import { TableSection } from './section-table';

/** The sections added after the first kit (13 onwards). Add a section here and a nav link below; the gallery file stays as it is. */
export const MORE_NAV: ReadonlyArray<readonly [string, string]> = [
  ['secrets', 'PIN and code'],
  ['table', 'Table'],
  ['pages', 'Pages and boxes'],
  ['choices', 'Forms and choices'],
];

export function MoreSections() {
  return (
    <>
      <SecretsSection />
      <TableSection />
      <PagesSection />
      <ChoicesSection />
    </>
  );
}
