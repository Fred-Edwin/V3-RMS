import type { Request, Response } from 'express';
import * as hrService from '../services/hr-service';
import * as hrRepository from '../repositories/hr-repository';
import { uploadImageBuffer } from '../utils/cloudinary';
import {
  createEmployeeProfileSchema,
  updateEmployeeProfileSchema,
  updatePaymentDetailsSchema,
  selfServiceProfileSchema,
  createContractTypeSchema,
  updateContractTypeSchema,
  contractTypesQuerySchema,
  assignContractSchema,
  uploadHrDocumentSchema,
  updateLeaveBalanceSchema,
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  createDisciplinaryRecordSchema,
  hrDashboardQuerySchema,
  leaveCalendarQuerySchema,
  leaveRequestsQuerySchema,
  attendanceSummaryQuerySchema,
  attendanceDetailQuerySchema,
  userIdParamSchema,
  hrRouteIdParamSchema,
  leaveTypeParamSchema,
} from '../validators/hr-schemas';
import type { UserRole } from '@prisma/client';

function getActor(req: Request): hrService.HrActor {
  return {
    id: req.user!.id,
    role: req.user!.role as UserRole,
    organizationId: req.user!.organizationId ?? null,
  };
}


// ─── Employee Profiles ────────────────────────────────────────────────────────

export async function createProfile(req: Request, res: Response): Promise<void> {
  const body = createEmployeeProfileSchema.parse(req.body);
  const actor = getActor(req);

  const profile = await hrService.createEmployeeProfile(actor, {
    userId: body.userId,
    nationalId: body.nationalId,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
    personalPhone: body.personalPhone,
    personalEmail: body.personalEmail,
    physicalAddress: body.physicalAddress,
    emergencyName: body.emergencyName,
    emergencyRelation: body.emergencyRelation,
    emergencyPhone: body.emergencyPhone,
    employmentType: body.employmentType,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    probationEndDate: body.probationEndDate ? new Date(body.probationEndDate) : undefined,
    jobTitle: body.jobTitle,
    reportingManagerId: body.reportingManagerId,
    notes: body.notes,
  });

  res.status(201).json({ success: true, data: { profile } });
}

export async function listProfiles(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const profiles = await hrService.listEmployeeProfiles(actor);
  res.json({ success: true, data: { profiles } });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const profile = await hrService.getEmployeeProfile(actor, userId);
  res.json({ success: true, data: { profile } });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body = updateEmployeeProfileSchema.parse(req.body);
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);

  const profile = await hrService.updateEmployeeProfile(actor, userId, {
    nationalId: body.nationalId,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
    personalPhone: body.personalPhone,
    personalEmail: body.personalEmail,
    physicalAddress: body.physicalAddress,
    emergencyName: body.emergencyName,
    emergencyRelation: body.emergencyRelation,
    emergencyPhone: body.emergencyPhone,
    employmentType: body.employmentType,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate === null ? null : body.endDate ? new Date(body.endDate) : undefined,
    probationEndDate: body.probationEndDate === null ? null : body.probationEndDate ? new Date(body.probationEndDate) : undefined,
    jobTitle: body.jobTitle,
    reportingManagerId: body.reportingManagerId === null ? null : body.reportingManagerId,
    notes: body.notes,
    kraPIN: body.kraPIN === null ? null : body.kraPIN,
    bankName: body.bankName === null ? null : body.bankName,
    accountNumber: body.accountNumber === null ? null : body.accountNumber,
    accountName: body.accountName === null ? null : body.accountName,
    bankBranch: body.bankBranch === null ? null : body.bankBranch,
    helbNumber: body.helbNumber === null ? null : body.helbNumber,
  });

  res.json({ success: true, data: { profile } });
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const body = selfServiceProfileSchema.parse(req.body);
  const actor = getActor(req);

  const profile = await hrService.updateMyProfile(actor, {
    ...body,
    dateOfBirth: body.dateOfBirth === null ? null : body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
  });

  res.json({ success: true, data: { profile } });
}

export async function updateMyPaymentDetails(req: Request, res: Response): Promise<void> {
  const body = updatePaymentDetailsSchema.parse(req.body);
  const actorId = req.user!.id;

  const existing = await hrRepository.findProfileByUserId(actorId);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Employee profile not found. Contact HR to create your profile first.' });
    return;
  }

  const profile = await hrRepository.updateProfile(existing.id, {
    kraPIN: body.kraPIN,
    bankName: body.bankName,
    accountNumber: body.accountNumber,
    accountName: body.accountName,
    bankBranch: body.bankBranch,
    helbNumber: body.helbNumber,
  });

  res.json({ success: true, data: { profile } });
}

// ─── Contract Types ───────────────────────────────────────────────────────────

export async function listContractTypes(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = contractTypesQuerySchema.parse(req.query);
  const contractTypes = await hrService.listContractTypes(actor, query.includeInactive ?? false);
  res.json({ success: true, data: { contractTypes } });
}

export async function createContractType(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const body = createContractTypeSchema.parse(req.body);
  const contractType = await hrService.createContractType(actor, body);
  res.status(201).json({ success: true, data: { contractType } });
}

export async function updateContractType(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const body = updateContractTypeSchema.parse(req.body);
  const contractType = await hrService.updateContractType(actor, id, body);
  res.json({ success: true, data: { contractType } });
}

export async function assignContract(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const body = assignContractSchema.parse(req.body);
  const profile = await hrService.assignContract(actor, userId, body.contractTypeId);
  res.json({ success: true, data: { profile } });
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function getMyLeaveBalances(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const balances = await hrService.getLeaveBalances(actor, actor.id);
  res.json({ success: true, data: { balances } });
}

export async function getLeaveBalances(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const balances = await hrService.getLeaveBalances(actor, userId);
  res.json({ success: true, data: { balances } });
}

export async function updateLeaveBalance(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const { leaveType } = leaveTypeParamSchema.parse(req.params);
  const body = updateLeaveBalanceSchema.parse(req.body);

  const balance = await hrService.updateLeaveBalance(
    actor,
    userId,
    leaveType as import('@prisma/client').LeaveType,
    body.leaveYear,
    body.totalDays,
  );
  res.json({ success: true, data: { balance } });
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function submitLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const body = createLeaveRequestSchema.parse(req.body);

  const request = await hrService.submitLeaveRequest(actor, {
    leaveType: body.leaveType,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
    reason: body.reason,
  });

  res.status(201).json({ success: true, data: { request } });
}

export async function getMyLeaveRequests(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const result = await hrService.getMyLeaveRequests(actor, Number(page), Number(limit));
  res.json({ success: true, data: result });
}

export async function listLeaveRequests(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { resolvedSinceDays, excludeAcknowledgedByMe, ...query } = leaveRequestsQuerySchema.parse(req.query);
  const resolvedSince = resolvedSinceDays
    ? new Date(Date.now() - resolvedSinceDays * 24 * 60 * 60 * 1000)
    : undefined;
  const result = await hrService.listLeaveRequests(actor, { ...query, resolvedSince, excludeAcknowledgedByMe });
  res.json({ success: true, data: result });
}

export async function acknowledgeLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  await hrService.acknowledgeLeaveRequest(actor, id);
  res.json({ success: true });
}

export async function acknowledgeAllResolvedLeaveRequests(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const result = await hrService.acknowledgeAllResolvedLeaveRequests(actor);
  res.json({ success: true, data: result });
}

export async function approveLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const body = reviewLeaveRequestSchema.parse(req.body);
  const result = await hrService.approveLeaveRequest(actor, id, body.comment);
  const { shiftConflicts, ...request } = result;
  res.json({ success: true, data: { request, shiftConflicts: shiftConflicts ?? [] } });
}

export async function rejectLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const body = reviewLeaveRequestSchema.parse(req.body);
  const request = await hrService.rejectLeaveRequest(actor, id, body.comment);
  res.json({ success: true, data: { request } });
}

export async function cancelLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const request = await hrService.cancelLeaveRequest(actor, id);
  res.json({ success: true, data: { request } });
}

export async function revertLeaveRequest(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const request = await hrService.revertLeaveRequest(actor, id);
  res.json({ success: true, data: { request } });
}

export async function getLeaveCalendar(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = leaveCalendarQuerySchema.parse(req.query);
  const now = new Date();
  const entries = await hrService.getLeaveCalendar(actor, {
    organizationId: query.organizationId,
    year: query.year ?? now.getFullYear(),
    month: query.month ?? now.getMonth() + 1,
  });
  res.json({ success: true, data: { entries } });
}

// ─── Disciplinary Records ─────────────────────────────────────────────────────

export async function createDisciplinaryRecord(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const body = createDisciplinaryRecordSchema.parse(req.body);

  // Resolve employee profile by userId
  const profile = await hrRepository.findProfileByUserId(body.employeeUserId);
  if (!profile) {
    res.status(404).json({ error: 'Employee profile not found for this user' });
    return;
  }

  const record = await hrService.createDisciplinaryRecord(actor, {
    employeeProfileId: profile.id,
    organizationId: profile.user.organizationId!,
    incidentDate: new Date(body.incidentDate),
    actionDate: new Date(body.actionDate),
    category: body.category,
    description: body.description,
    actionTaken: body.actionTaken,
    outcome: body.outcome,
    issuedById: actor.id,
    witnesses: body.witnesses,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  });

  res.status(201).json({ success: true, data: { record } });
}

export async function getDisciplinaryRecords(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const records = await hrService.getDisciplinaryRecords(actor, userId);
  res.json({ success: true, data: { records } });
}

export async function acknowledgeDisciplinaryRecord(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { id } = hrRouteIdParamSchema.parse(req.params);
  const record = await hrService.acknowledgeDisciplinaryRecord(actor, id);
  res.json({ success: true, data: { record } });
}

// ─── HR Documents ─────────────────────────────────────────────────────────────

export async function uploadHrDocument(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Multipart form fields arrive as strings; normalize empty optionals before validation
  const { employeeUserId, documentType, leaveRequestId, disciplinaryRecordId } =
    uploadHrDocumentSchema.parse({
      employeeUserId: req.body.employeeUserId,
      documentType: req.body.documentType,
      leaveRequestId: req.body.leaveRequestId || undefined,
      disciplinaryRecordId: req.body.disciplinaryRecordId || undefined,
    });

  // Ownership + doc-type restrictions enforced in the service
  const profile = await hrService.authorizeDocumentUpload(actor, employeeUserId, documentType);

  const fileUrl = await uploadImageBuffer(req.file.buffer, 'hr-documents');
  const doc = await hrRepository.createHrDocument({
    employeeProfileId: profile.id,
    leaveRequestId: leaveRequestId || undefined,
    disciplinaryRecordId: disciplinaryRecordId || undefined,
    documentType,
    fileName: req.file.originalname,
    fileUrl,
    uploadedById: actor.id,
  });

  res.status(201).json({ success: true, data: { document: doc } });
}

export async function getHrDocuments(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);

  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) {
    res.status(404).json({ error: 'Employee profile not found' });
    return;
  }

  // Self-access or management
  if (actor.id !== userId) {
    const isSameBranch = actor.role === 'MANAGER' && actor.organizationId === profile.user.organizationId;
    const isHrAuth = actor.role === 'HR_MANAGER' || actor.role === 'DIRECTOR' || actor.role === 'SYSTEM_ADMIN';
    if (!isSameBranch && !isHrAuth) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  const documents = await hrRepository.listHrDocuments(profile.id);
  res.json({ success: true, data: { documents } });
}

export async function deleteHrDocument(req: Request, res: Response): Promise<void> {
  const { id } = hrRouteIdParamSchema.parse(req.params);
  await hrService.deleteHrDocument(id);
  res.json({ success: true });
}

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = attendanceSummaryQuerySchema.parse(req.query);
  const rows = await hrService.getAttendanceSummary(
    actor,
    new Date(query.startDate),
    new Date(query.endDate),
    query.organizationId,
    query.userId,
  );
  res.json({ success: true, data: { rows } });
}

export async function getStaffAttendanceDetail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const query = attendanceDetailQuerySchema.parse(req.query);
  const days = await hrService.getStaffAttendanceDetail(
    actor,
    userId,
    new Date(query.startDate),
    new Date(query.endDate),
  );
  res.json({ success: true, data: { days } });
}

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

export async function getHrDashboard(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = hrDashboardQuerySchema.parse(req.query);
  const data = await hrService.getHrDashboard(actor, query.organizationId);
  res.json({ success: true, data });
}
