/**
 * Workforce Home: the public API. The route shell imports `WorkforceHome` and the nav drawer provider; a slice that adds a card imports
 * `defineHomeCard` and the block components it needs. Nothing deeper is imported from outside this folder. See README.md.
 */
export { WorkforceHome } from './components/home-screen';
export { WorkforceNavDrawerProvider, useWorkforceNavDrawer } from './hooks/use-nav-drawer';
export { useWorkforcePermissions } from './hooks/use-workforce-permissions';
export { defineHomeCard, registerHomeCard, type CardDataState, type HomeCard, type HomeCardDefinition, type HomeSlot, type HomeSurface } from './lib/card-registry';
export type { WorkforceCapability } from './lib/capabilities';
export { HomeButton } from './components/home-button';
export { SectionHeader } from './components/section-header';
export { AttentionList, type AttentionItem, type AttentionKind } from './components/attention-list';
export { PeopleByBranch, type BranchCount } from './components/people-by-branch';
export { ComingUpSection } from './components/coming-up-section';
export { BranchNowHeader, DepartmentChips, NeedsALook, OnTimeByDepartment, type DepartmentChip, type DepartmentLine, type LookRow } from './components/branch-board';
export { WaitingForYouCard, WaitingForYouColumn, type WaitingItem, type WaitingAction } from './components/waiting-for-you';
export { JobCardsSlot, ServiceTeamCard, WeekCard, type TeamRow } from './components/phone-cards';
export { PhoneBarAction, PhoneHomeBar } from './components/phone-home-bar';
export { HomeLayout, HomeStack } from './components/home-stack';
