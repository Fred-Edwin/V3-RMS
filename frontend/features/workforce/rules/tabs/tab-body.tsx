'use client';

import * as React from 'react';

import type { RuleGroupCode } from '../types/rules-types';
import { AttendanceTab } from './attendance-tab';
import { ConductTab } from './conduct-tab';
import { LatenessTab } from './lateness-tab';
import { OvertimeTab } from './overtime-tab';
import { ProbationTab } from './probation-tab';
import type { TabProps } from './tab-types';
import { WeekTab } from './week-tab';

/** Which component draws each group. */
const BODIES: Partial<Record<RuleGroupCode, React.ComponentType<TabProps>>> = {
  LATENESS: LatenessTab,
  OVERTIME: OvertimeTab,
  ATTENDANCE: AttendanceTab,
  PROBATION: ProbationTab,
  CONDUCT: ConductTab,
  WEEK_AND_BREAKS: WeekTab,
};

export function TabBody(props: TabProps) {
  const Body = BODIES[props.page.group];
  return Body ? <Body {...props} /> : null;
}
