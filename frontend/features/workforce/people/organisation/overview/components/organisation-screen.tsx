'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { PositionsTab } from '../../positions/components/positions-tab';
import { SitesTab } from './sites-tab';

/** Organisation (Paper Chapter 3): two tabs, chosen by the address (`?tab=positions`). The Positions tab is a tab here, not its own menu row. */
export function OrganisationScreen() {
  const tab = useSearchParams().get('tab');
  return tab === 'positions' ? <PositionsTab /> : <SitesTab />;
}
