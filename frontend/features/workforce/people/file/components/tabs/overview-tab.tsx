import * as React from 'react';

import type { EmployeeFile } from '../../../_shared/types/people-types';
import { overviewVariant } from '../../lib/file-rows';
import { BranchOverview } from './overview-branch';
import { ExitedOverview } from './overview-exited';
import { HrOverview } from './overview-hr';
import { OnboardingOverview } from './overview-onboarding';
import type { OpenDialog } from './overview-parts';

/** Picks the Overview Paper draws for this file and this viewer. The exit banner and the Branch Manager's numbers sit above the tabs. */
export function OverviewTab({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  switch (overviewVariant(file)) {
    case 'exited':
      return <ExitedOverview file={file} open={open} />;
    case 'onboarding':
      return <OnboardingOverview file={file} open={open} />;
    case 'branch':
      return <BranchOverview file={file} open={open} />;
    default:
      return <HrOverview file={file} open={open} />;
  }
}
