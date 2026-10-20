import { logger } from '../../../utils/logger';
import { setWrongThresholdListener } from '../_shared/pin/pin-door';
import { resolveActor } from '../people/people-context';
import { runAudited } from '../_shared/audit/audit-writer';
import { setDeviceConfirmationSource } from '../payslips/unlock/device-source';
import { employeesRepository } from '../people/employees/employees-repository';
import { confirmationOf } from './devices/devices-service';
import { securityEntry } from './security-context';

/**
 * Start-up wiring (routes/index.ts):
 *   - the payslip code asks the shared phone list whether a phone is confirmed (always true or false now, never unknown);
 *   - the 3rd wrong signing PIN is written to Activity on the person's record as a flagged entry (no alert row, SD16).
 */
export function registerSecurity(): void {
  setDeviceConfirmationSource((userId, deviceId) => confirmationOf(userId, deviceId));
  setWrongThresholdListener(async ({ userId, purpose, count, at }) => {
    try {
      const user = await employeesRepository.findActor(userId);
      if (!user) return;
      const actor = await resolveActor({ id: user.id, role: user.role, siteId: user.siteId ?? null });
      await runAudited<void>(async () => ({
        result: undefined,
        entries: [securityEntry({ companyId: actor.companyId, siteId: user.siteId ?? null, actor: { id: userId, role: user.role, name: actor.name }, action: 'security.signing_pin_wrong', subjectType: 'User', subjectId: userId, subjectUserId: userId, after: { purpose, count, at: at.toISOString() } })],
      }));
    } catch (error) {
      logger.error({ err: error }, 'signing pin wrong entry failed');
    }
  });
}
