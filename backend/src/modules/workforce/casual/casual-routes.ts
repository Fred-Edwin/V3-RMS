import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { approvalController as approval } from './approval/approval-controller';
import { recordingController as recording } from './recording/recording-controller';
import { sheetController as sheets } from './sheet/sheet-controller';

/**
 * Casual pay (Segment 3, PD19 to PD29). Every route: authenticate, attachWorkforceSubject, the capability; the services check the
 * record's site and department (a sheet outside the caller's reach is a 404) and the state and version (409). No requireRole here.
 *   C1 the day's sheet · C2 save lines (creates the sheet) · C3 one sheet · C4 waiting for me · C5 recent · C6 my casuals · C7 add a casual
 *   C8 send · C9 take back · C10 approve · C11 send back · C12 void · C13 add / C14 remove a correction · C15 a worker's receipt
 *   C16 preview PDF · C17 approved PDF · C18 the month summary for Payroll
 */
const C = '/workforce/casuals';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const READ = ['casual.read', 'casual.record', 'casual.approve'] as const;

router.get(`${C}/sheets`, ...base, requireCapability(...READ), sheets.day); // C1
router.put(`${C}/sheets/lines`, ...base, requireCapability('casual.record'), recording.putLines); // C2
router.get(`${C}/sheets/waiting`, ...base, requireCapability('casual.approve'), sheets.waiting); // C4
router.get(`${C}/sheets/recent`, ...base, requireCapability(...READ), sheets.recent); // C5
router.get(`${C}/sheets/:id`, ...base, requireCapability(...READ), sheets.byId); // C3
router.get(`${C}/people`, ...base, requireCapability(...READ), sheets.workers); // C6
router.post(`${C}/people`, ...base, requireCapability('casual.record'), recording.addCasual); // C7

router.post(`${C}/sheets/:id/send`, ...base, requireCapability('casual.record'), recording.send); // C8
router.post(`${C}/sheets/:id/take-back`, ...base, requireCapability('casual.record'), recording.takeBack); // C9
router.post(`${C}/sheets/:id/approve`, ...base, requireCapability('casual.approve'), approval.approve); // C10
router.post(`${C}/sheets/:id/send-back`, ...base, requireCapability('casual.approve'), approval.sendBack); // C11
router.post(`${C}/sheets/:id/void`, ...base, requireCapability('casual.approve'), approval.void); // C12
router.post(`${C}/sheets/:id/corrections`, ...base, requireCapability('casual.record'), recording.addCorrection); // C13
router.delete(`${C}/sheets/:id/corrections/:correctionId`, ...base, requireCapability('casual.record'), recording.removeCorrection); // C14
router.post(`${C}/sheets/:id/lines/:lineId/receive`, ...base, requireCapability('casual.record'), approval.receive); // C15

router.get(`${C}/sheets/:id/preview`, ...base, requireCapability(...READ), sheets.preview); // C16
router.get(`${C}/sheets/:id/document`, ...base, requireCapability(...READ), sheets.document); // C17
router.get(`${C}/months/:monthKey/summary`, ...base, requireCapability('payroll.read'), sheets.monthSummary); // C18

export default router;
