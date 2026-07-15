import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import * as hrController from '../controllers/hr-controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const HR_AUTHORITY = ['HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'] as const;
const HR_AND_MANAGER = ['HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER'] as const;
const ALL_STAFF = [
  'HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER',
  'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING',
] as const;

// ─── Employee Profiles ────────────────────────────────────────────────────────

router.post(
  '/hr/profiles',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.createProfile,
);

router.get(
  '/hr/profiles',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.listProfiles,
);

// Self-service: staff update their own bank/KRA details — must be before /:userId
router.patch(
  '/hr/profiles/my/payment-details',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.updateMyPaymentDetails,
);

// Self-service: staff update their own personal details — must be before /:userId
router.patch(
  '/hr/profiles/me',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.updateMyProfile,
);

// HR assigns/changes a staff member's contract type (re-seeds leave balances)
router.patch(
  '/hr/profiles/:userId/contract',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.assignContract,
);

// Self-access OR management — access control handled in service
router.get(
  '/hr/profiles/:userId',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.getProfile,
);

router.patch(
  '/hr/profiles/:userId',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.updateProfile,
);

// ─── Contract Types ───────────────────────────────────────────────────────────

router.get(
  '/hr/contract-types',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.listContractTypes,
);

router.post(
  '/hr/contract-types',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.createContractType,
);

router.patch(
  '/hr/contract-types/:id',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.updateContractType,
);

// ─── Leave Balances ───────────────────────────────────────────────────────────

router.get(
  '/hr/leave/balances/my',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.getMyLeaveBalances,
);

router.get(
  '/hr/leave/balances/:userId',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.getLeaveBalances,
);

router.put(
  '/hr/leave/balances/:userId/:leaveType',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.updateLeaveBalance,
);

// ─── Leave Requests ───────────────────────────────────────────────────────────

// Must register /my BEFORE /:id
router.get(
  '/hr/leave/requests/my',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.getMyLeaveRequests,
);

router.get(
  '/hr/leave/calendar',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.getLeaveCalendar,
);

router.post(
  '/hr/leave/request',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.submitLeaveRequest,
);

router.get(
  '/hr/leave/requests',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.listLeaveRequests,
);

// Must register before /:id/acknowledge to avoid Express matching 'acknowledge-all' as an :id
router.post(
  '/hr/leave/requests/acknowledge-all',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.acknowledgeAllResolvedLeaveRequests,
);

router.post(
  '/hr/leave/requests/:id/acknowledge',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.acknowledgeLeaveRequest,
);

router.post(
  '/hr/leave/requests/:id/approve',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.approveLeaveRequest,
);

router.post(
  '/hr/leave/requests/:id/reject',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.rejectLeaveRequest,
);

router.post(
  '/hr/leave/requests/:id/cancel',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.cancelLeaveRequest,
);

router.post(
  '/hr/leave/requests/:id/revert',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.revertLeaveRequest,
);

// ─── Disciplinary Records ─────────────────────────────────────────────────────

router.post(
  '/hr/disciplinary',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.createDisciplinaryRecord,
);

router.get(
  '/hr/disciplinary/:userId',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.getDisciplinaryRecords,
);

router.post(
  '/hr/disciplinary/:id/acknowledge',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.acknowledgeDisciplinaryRecord,
);

// ─── HR Documents ─────────────────────────────────────────────────────────────

// Upload before /:userId to avoid Express matching 'upload' as a userId.
// Open to all staff: non-HR uploaders are restricted in the service to their
// own profile + self-serviceable document types.
router.post(
  '/hr/documents/upload',
  authenticate,
  requireRole(...ALL_STAFF),
  upload.single('file'),
  hrController.uploadHrDocument,
);

router.get(
  '/hr/documents/:userId',
  authenticate,
  requireRole(...ALL_STAFF),
  hrController.getHrDocuments,
);

// ─── Attendance Analytics ─────────────────────────────────────────────────────

router.get(
  '/hr/attendance',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.getAttendanceSummary,
);

// Must register /attendance before /:userId to avoid Express matching 'attendance' as userId
router.get(
  '/hr/attendance/:userId',
  authenticate,
  requireRole(...HR_AND_MANAGER),
  hrController.getStaffAttendanceDetail,
);

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

router.get(
  '/hr/dashboard',
  authenticate,
  requireRole(...HR_AUTHORITY),
  hrController.getHrDashboard,
);

export default router;
