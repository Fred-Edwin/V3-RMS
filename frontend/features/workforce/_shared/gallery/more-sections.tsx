import * as React from 'react';

import { ChoicesSection } from './section-choices';
import { PagesSection } from './section-pages';
import { DocumentSection, HomeSection } from './section-home';
import { PhoneSection } from './section-phone';
import { ScheduleSection } from './section-schedule';
import { SecretsSection } from './section-secrets';
import { TableSection } from './section-table';

/** The sections added after the first kit (13 onwards). Add a section here and a nav link below; the gallery file stays as it is. */
export const MORE_NAV: ReadonlyArray<readonly [string, string]> = [
  ['secrets', 'PIN and code'],
  ['table', 'Table'],
  ['pages', 'Pages and boxes'],
  ['choices', 'Forms and choices'],
  ['schedule', 'Schedule'],
  ['phone', 'Phone'],
  ['home', 'Home rows and drawer'],
  ['document', 'Document'],
];

export function MoreSections() {
  return (
    <>
      <SecretsSection />
      <TableSection />
      <PagesSection />
      <ChoicesSection />
      <ScheduleSection />
      <PhoneSection />
      <HomeSection />
      <DocumentSection />
    </>
  );
}
