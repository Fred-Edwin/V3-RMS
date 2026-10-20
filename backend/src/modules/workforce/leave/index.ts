/**
 * THE door of Leave (Segment 4). Everything outside `leave/` imports from here and from nowhere else inside the folder.
 * Spec: docs/features/workforce/specs/4-leave-spec.md.
 */
export { default as workforceLeaveRouter } from './leave-routes';
export { registerLeave } from './register-leave';
export { sweepLeave } from './applications/escalation-service';
export { assertLegacyLeaveWritable } from './carry/legacy-guard';
export { carryLegacyLeave, mirrorLegacyLeave } from './carry/carry-service';
export { onLeaveAt, comingUp } from './reads/away-on';
export { verifyLeaveSlip, leaveSlipDocument, registerLeaveSlipDocument, type LeaveSlipVerdict, type DocumentKindRegistration } from './slip/slip-service';
