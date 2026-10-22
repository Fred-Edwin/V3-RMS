/**
 * Workforce Home: the public API. The route shells import `RoleHomeScreen`, `NeedsYouPageScreen`, `TodayScreen` and the nav drawer
 * provider. Nothing deeper is imported from outside this folder. See README.md.
 */
export { NeedsYouPageScreen, RoleHomeScreen, breadcrumbFor } from './role-home';
export { TodayScreen } from './components/today-screen';
export { WorkforceNavDrawerProvider, useWorkforceNavDrawer } from '../_shared';
export { useWorkforcePermissions } from '../_shared';
export { defineHomeCard, registerHomeCard, type CardDataState, type HomeCard, type HomeCardDefinition, type HomeSlot, type HomeSurface } from './lib/card-registry';
export type { WorkforceCapability } from '../_shared';
