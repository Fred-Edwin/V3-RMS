import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { employeesController as c } from './employees-controller';
import { attachWorkforceSubject } from './people-subject';

/**
 * Every /workforce/people route: authenticate, then attachWorkforceSubject (head rows and "clocks in"), then the
 * capability. Scope and "not their own" rules are checked in the service on the actual record. Static paths come
 * before `/:id` so `drafts`, `summary` and the rest are never read as an id.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDF files are allowed'));
  },
});

const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const P = '/workforce/people';

// ---- static paths first -------------------------------------------------------------------------------
router.get(P, ...base, requireCapability('employee.read_basic'), c.list); // R1
router.get(`${P}/summary`, ...base, requireCapability('employee.read_basic'), c.summary); // R2
router.get(`${P}/lookups`, ...base, requireCapability('employee.read_basic', 'org.read'), c.lookups); // R3
router.get(`${P}/duplicate-check`, ...base, requireCapability('employee.write_basic'), c.duplicateCheck); // R4
router.get(`${P}/unlinked-accounts`, ...base, requireCapability('employee.lifecycle'), c.unlinkedAccounts); // R5
router.get(`${P}/me`, ...base, requireCapability('me.file'), c.mine); // R6
router.get(`${P}/pay-changes`, ...base, requireCapability('payprofile.approve', 'payprofile.write'), c.payChanges); // R11
router.get(`${P}/drafts`, ...base, requireCapability('employee.write_basic'), c.listDrafts); // W1
router.post(`${P}/drafts`, ...base, requireCapability('employee.write_basic'), c.createDraft); // W2
router.patch(`${P}/drafts/:id`, ...base, requireCapability('employee.write_basic'), c.updateDraft); // W3
router.delete(`${P}/drafts/:id`, ...base, requireCapability('employee.write_basic'), c.deleteDraft); // W4
router.post(`${P}/pay-changes/:changeId/decision`, ...base, requireCapability('payprofile.approve'), c.decidePayChange); // W11
router.patch(`${P}/me`, ...base, requireCapability('me.file'), c.patchMe); // W7
router.post(`${P}/me/photo`, ...base, requireCapability('me.file'), imageUpload.single('file'), c.photo); // W8 (own)
router.post(P, ...base, requireCapability('employee.write_basic'), c.hire); // W5

// ---- one person -------------------------------------------------------------------------------------------
router.get(`${P}/:id`, ...base, requireCapability('employee.read_basic', 'me.file'), c.file); // R7
router.get(`${P}/:id/pay`, ...base, requireCapability('payprofile.read', 'me.payprofile'), c.pay); // R8
router.get(`${P}/:id/documents`, ...base, requireCapability('employee.read_sensitive', 'me.file'), c.documents); // R9
router.get(`${P}/:id/documents/:docId`, ...base, requireCapability('employee.read_sensitive', 'me.file'), c.openDocument); // R10
router.patch(`${P}/:id`, ...base, requireCapability('employee.write_basic', 'employee.write_sensitive'), c.update); // W6
router.post(`${P}/:id/photo`, ...base, requireCapability('employee.write_basic', 'me.file'), imageUpload.single('file'), c.photo); // W8
router.put(`${P}/:id/pay-profile`, ...base, requireCapability('payprofile.write'), c.updatePayProfile); // W9
router.post(`${P}/:id/pay-changes`, ...base, requireCapability('payprofile.write'), c.requestPayChange); // W10
router.post(`${P}/:id/contract`, ...base, requireCapability('employee.write_sensitive'), c.createContract); // W12
router.post(`${P}/:id/probation-decision`, ...base, requireCapability('employee.lifecycle'), c.decideProbation); // W13
router.post(`${P}/:id/probation-notes`, ...base, requireCapability('probation.note'), c.probationNote); // W14
router.post(`${P}/:id/transfer/preview`, ...base, requireCapability('employee.lifecycle'), c.previewTransfer); // W15
router.post(`${P}/:id/transfer`, ...base, requireCapability('employee.lifecycle'), c.transfer); // W16
router.post(`${P}/:id/loan`, ...base, requireCapability('employee.lifecycle'), c.loan); // W17
router.post(`${P}/:id/moves/:moveId/cancel`, ...base, requireCapability('employee.lifecycle'), c.cancelMove); // W18
router.post(`${P}/:id/moves/:moveId/end`, ...base, requireCapability('employee.lifecycle'), c.endMove); // W18
router.post(`${P}/:id/exit/preview`, ...base, requireCapability('employee.lifecycle'), c.previewExit); // W19
router.post(`${P}/:id/exit/undo`, ...base, requireCapability('employee.lifecycle'), c.undoExit); // W22
router.post(`${P}/:id/exit`, ...base, requireCapability('employee.lifecycle'), c.exit); // W20
router.patch(`${P}/:id/exit/checklist`, ...base, requireCapability('employee.lifecycle'), c.exitChecklist); // W21
router.post(`${P}/:id/rehire`, ...base, requireCapability('employee.lifecycle'), c.rehire); // W23
router.post(`${P}/:id/login`, ...base, requireCapability('employee.lifecycle'), c.createLogin); // W24
router.post(`${P}/:id/file-requests`, ...base, requireCapability('employee.write_basic'), c.askForDetail); // W25
router.post(`${P}/:id/file-requests/:requestId/remind`, ...base, requireCapability('employee.write_basic'), c.remind); // W25
router.post(`${P}/:id/verify-statutory`, ...base, requireCapability('employee.write_sensitive'), c.verifyStatutory); // W26
router.post(`${P}/:id/documents`, ...base, requireCapability('employee.write_sensitive', 'me.file'), documentUpload.single('file'), c.uploadDocument); // W27
router.post(`${P}/:id/reveal`, ...base, requireCapability('employee.read_sensitive', 'me.file'), c.reveal); // W28

export default router;
