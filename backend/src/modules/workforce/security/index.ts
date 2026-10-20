/**
 * THE door of the Workforce security module (6a S1 to S4). Other modules call:
 *   wasntMe(subject, { idempotencyKey, deviceId?, entryId? }, { deviceLabel?, placeLabel? })  "This wasn't me" (Activity on my record answer NOT_ME)
 *   claimAlertWindow / insertAlertForEntry / tellAdminsOfAlert                               raise a System Admin alert in the entry's transaction
 *   confirmationOf(userId, deviceId)                                                          is this phone confirmed?
 *   workforceSessionGate                                                                      mounted before every /workforce router
 */
export { default as workforceSecurityRouter } from './security-routes';
export { registerSecurity } from './register-security';
export { workforceSessionGate, forgetSession } from './session/reset-gate';
export { wasntMe, type WasntMeInput, type WasntMeContext } from './session/wasnt-me-service';
export { claimAlertWindow, insertAlertForEntry, tellAdminsOfAlert, alertsStarted, type AlertFacts } from './alerts/alerts-raise';
export { confirmationOf } from './devices/devices-service';
export { phoneLabelOf, placeLabelOf } from './devices/device-label';
export type { AlertKind, AlertRow } from './security-types';
