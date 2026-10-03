import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as hrRepository from '../repositories/hr-repository';
import * as hrService from './hr-service';
import * as cloudinaryUtils from '../utils/cloudinary';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: {},
}));

vi.mock('../repositories/hr-repository', () => ({
  findProfileByUserId: vi.fn(),
  updateProfile: vi.fn(),
  listContractTypes: vi.fn(),
  findContractTypeById: vi.fn(),
  findContractTypeByName: vi.fn(),
  createContractType: vi.fn(),
  updateContractType: vi.fn(),
  assignContractAndSyncBalances: vi.fn(),
  findHrDocumentById: vi.fn(),
  deleteHrDocument: vi.fn(),
  findHrDocumentsByProfileAndType: vi.fn(),
  replaceHrDocuments: vi.fn(),
}));

vi.mock('./fcm-service', () => ({
  fcmService: {},
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../utils/cloudinary', () => ({
  destroyUploadedFile: vi.fn(),
}));

const hrActor: hrService.HrActor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'HR_MANAGER',
  siteId: null,
};

const waiterActor: hrService.HrActor = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'WAITER',
  siteId: '33333333-3333-4333-8333-333333333333',
};

const managerActor: hrService.HrActor = {
  id: '44444444-4444-4444-8444-444444444444',
  role: 'MANAGER',
  siteId: '33333333-3333-4333-8333-333333333333',
};

const waiterProfile = {
  id: 'profile-1',
  userId: waiterActor.id,
  user: {
    id: waiterActor.id,
    name: 'Jane Waiter',
    role: 'WAITER',
    siteId: waiterActor.siteId,
  },
};

describe('assignContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-HR actors', async () => {
    await expect(
      hrService.assignContract(managerActor, waiterActor.id, 'ct-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(hrRepository.assignContractAndSyncBalances).not.toHaveBeenCalled();
  });

  it('rejects when the employee profile does not exist', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(null);
    await expect(
      hrService.assignContract(hrActor, waiterActor.id, 'ct-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects an unknown contract type', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
    vi.mocked(hrRepository.findContractTypeById).mockResolvedValue(null);
    await expect(
      hrService.assignContract(hrActor, waiterActor.id, 'ct-missing'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects an inactive contract type', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
    vi.mocked(hrRepository.findContractTypeById).mockResolvedValue({
      id: 'ct-1',
      isActive: false,
    } as never);
    await expect(
      hrService.assignContract(hrActor, waiterActor.id, 'ct-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('assigns the contract and syncs balances for the current leave year', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
    vi.mocked(hrRepository.findContractTypeById).mockResolvedValue({
      id: 'ct-1',
      isActive: true,
    } as never);
    vi.mocked(hrRepository.assignContractAndSyncBalances).mockResolvedValue(
      waiterProfile as never,
    );

    await hrService.assignContract(hrActor, waiterActor.id, 'ct-1');

    expect(hrRepository.assignContractAndSyncBalances).toHaveBeenCalledWith(
      waiterProfile.id,
      'ct-1',
      new Date().getFullYear(),
    );
  });

  it('clears the contract without looking up a contract type', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
    vi.mocked(hrRepository.assignContractAndSyncBalances).mockResolvedValue(
      waiterProfile as never,
    );

    await hrService.assignContract(hrActor, waiterActor.id, null);

    expect(hrRepository.findContractTypeById).not.toHaveBeenCalled();
    expect(hrRepository.assignContractAndSyncBalances).toHaveBeenCalledWith(
      waiterProfile.id,
      null,
      new Date().getFullYear(),
    );
  });
});

describe('contract type management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-HR actors on list/create/update', async () => {
    await expect(hrService.listContractTypes(waiterActor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      hrService.createContractType(managerActor, { name: 'X', leavePolicies: [] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      hrService.updateContractType(waiterActor, 'ct-1', { name: 'Y' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects a duplicate contract type name on create', async () => {
    vi.mocked(hrRepository.findContractTypeByName).mockResolvedValue({ id: 'ct-1' } as never);
    await expect(
      hrService.createContractType(hrActor, {
        name: '6-Month Contract',
        leavePolicies: [{ leaveType: 'ANNUAL', totalDays: 10 }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates a contract type with its leave policies', async () => {
    vi.mocked(hrRepository.findContractTypeByName).mockResolvedValue(null);
    vi.mocked(hrRepository.createContractType).mockResolvedValue({ id: 'ct-new' } as never);

    await hrService.createContractType(hrActor, {
      name: '1-Year Contract',
      durationMonths: 12,
      leavePolicies: [
        { leaveType: 'ANNUAL', totalDays: 21 },
        { leaveType: 'SICK', totalDays: 10 },
      ],
    });

    expect(hrRepository.createContractType).toHaveBeenCalledWith(
      expect.objectContaining({ name: '1-Year Contract', durationMonths: 12 }),
    );
  });
});

describe('updateMyProfile (self-service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects staff without a profile', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(null);
    await expect(
      hrService.updateMyProfile(waiterActor, { personalPhone: '0712345678' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates the actor own profile only', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
    vi.mocked(hrRepository.updateProfile).mockResolvedValue(waiterProfile as never);

    await hrService.updateMyProfile(waiterActor, { personalPhone: '0712345678' });

    expect(hrRepository.findProfileByUserId).toHaveBeenCalledWith(waiterActor.id);
    expect(hrRepository.updateProfile).toHaveBeenCalledWith(waiterProfile.id, {
      personalPhone: '0712345678',
    });
  });
});

describe('authorizeDocumentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(waiterProfile as never);
  });

  it('allows HR authority to upload any document type for anyone', async () => {
    await expect(
      hrService.authorizeDocumentUpload(hrActor, waiterActor.id, 'CONTRACT'),
    ).resolves.toBe(waiterProfile);
  });

  it('allows a manager to upload for own-branch staff only', async () => {
    await expect(
      hrService.authorizeDocumentUpload(managerActor, waiterActor.id, 'CONTRACT'),
    ).resolves.toBe(waiterProfile);

    const otherBranchManager = { ...managerActor, siteId: 'other-org' };
    await expect(
      hrService.authorizeDocumentUpload(otherBranchManager, waiterActor.id, 'ID_COPY'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows staff to self-upload allowed document types', async () => {
    await expect(
      hrService.authorizeDocumentUpload(waiterActor, waiterActor.id, 'ID_COPY'),
    ).resolves.toBe(waiterProfile);
    await expect(
      hrService.authorizeDocumentUpload(waiterActor, waiterActor.id, 'CERTIFICATE'),
    ).resolves.toBe(waiterProfile);
  });

  it('blocks staff from uploading HR-only document types to their own profile', async () => {
    for (const documentType of ['CONTRACT', 'WARNING_LETTER', 'INCIDENT_REPORT'] as const) {
      await expect(
        hrService.authorizeDocumentUpload(waiterActor, waiterActor.id, documentType),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it('blocks staff from uploading to another staff member profile', async () => {
    const otherWaiter = { ...waiterActor, id: '99999999-9999-4999-8999-999999999999' };
    await expect(
      hrService.authorizeDocumentUpload(otherWaiter, waiterActor.id, 'ID_COPY'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects uploads for users without a profile', async () => {
    vi.mocked(hrRepository.findProfileByUserId).mockResolvedValue(null);
    await expect(
      hrService.authorizeDocumentUpload(hrActor, waiterActor.id, 'ID_COPY'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteHrDocument', () => {
  const unlinkedDocument = {
    id: 'doc-1',
    employeeProfileId: waiterProfile.id,
    fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/hr-documents/doc-1.pdf',
    leaveRequestId: null,
    disciplinaryRecordId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the document does not exist', async () => {
    vi.mocked(hrRepository.findHrDocumentById).mockResolvedValue(null);
    await expect(hrService.deleteHrDocument('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(hrRepository.deleteHrDocument).not.toHaveBeenCalled();
  });

  it('refuses deletion when linked to a disciplinary record', async () => {
    vi.mocked(hrRepository.findHrDocumentById).mockResolvedValue({
      ...unlinkedDocument,
      disciplinaryRecordId: 'record-1',
    } as never);

    await expect(hrService.deleteHrDocument('doc-1')).rejects.toBeInstanceOf(ConflictError);
    expect(hrRepository.deleteHrDocument).not.toHaveBeenCalled();
  });

  it('refuses deletion when linked to a leave request', async () => {
    vi.mocked(hrRepository.findHrDocumentById).mockResolvedValue({
      ...unlinkedDocument,
      leaveRequestId: 'leave-1',
    } as never);

    await expect(hrService.deleteHrDocument('doc-1')).rejects.toBeInstanceOf(ConflictError);
    expect(hrRepository.deleteHrDocument).not.toHaveBeenCalled();
  });

  it('deletes unlinked documents and best-effort cleans up Cloudinary', async () => {
    vi.mocked(hrRepository.findHrDocumentById).mockResolvedValue(unlinkedDocument as never);
    vi.mocked(cloudinaryUtils.destroyUploadedFile).mockResolvedValue(undefined);
    vi.mocked(hrRepository.deleteHrDocument).mockResolvedValue(unlinkedDocument as never);

    await expect(hrService.deleteHrDocument('doc-1')).resolves.toBe(unlinkedDocument);
    expect(cloudinaryUtils.destroyUploadedFile).toHaveBeenCalledWith(unlinkedDocument.fileUrl);
    expect(hrRepository.deleteHrDocument).toHaveBeenCalledWith('doc-1');
  });

  it('still deletes the DB row when Cloudinary cleanup rejects unexpectedly', async () => {
    // destroyUploadedFile is documented as best-effort/non-throwing, but the
    // DB delete must not be blocked even if that contract is ever violated.
    vi.mocked(hrRepository.findHrDocumentById).mockResolvedValue(unlinkedDocument as never);
    vi.mocked(cloudinaryUtils.destroyUploadedFile).mockRejectedValue(new Error('cloudinary down'));
    vi.mocked(hrRepository.deleteHrDocument).mockResolvedValue(unlinkedDocument as never);

    await expect(hrService.deleteHrDocument('doc-1')).resolves.toBe(unlinkedDocument);
    expect(hrRepository.deleteHrDocument).toHaveBeenCalledWith('doc-1');
  });
});

describe('createHrDocument (replace-on-reupload)', () => {
  const uploadData = {
    employeeProfileId: waiterProfile.id,
    documentType: 'NATIONAL_ID_FRONT' as const,
    fileName: 'id-front.jpg',
    fileUrl: 'https://res.cloudinary.com/demo/image/upload/v2/hr-documents/id-front-new.jpg',
    uploadedById: waiterActor.id,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with no prior deletions when no existing document of that type', async () => {
    vi.mocked(hrRepository.findHrDocumentsByProfileAndType).mockResolvedValue([]);
    vi.mocked(hrRepository.replaceHrDocuments).mockResolvedValue({ id: 'new-doc' } as never);

    await hrService.createHrDocument(uploadData);

    expect(hrRepository.replaceHrDocuments).toHaveBeenCalledWith([], uploadData);
    expect(cloudinaryUtils.destroyUploadedFile).not.toHaveBeenCalled();
  });

  it('deletes the prior same-type document and cleans up its Cloudinary asset', async () => {
    const oldDoc = {
      id: 'old-doc',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hr-documents/id-front-old.jpg',
      disciplinaryRecordId: null,
      leaveRequestId: null,
    };
    vi.mocked(hrRepository.findHrDocumentsByProfileAndType).mockResolvedValue([oldDoc as never]);
    vi.mocked(hrRepository.replaceHrDocuments).mockResolvedValue({ id: 'new-doc' } as never);
    vi.mocked(cloudinaryUtils.destroyUploadedFile).mockResolvedValue(undefined);

    await hrService.createHrDocument(uploadData);

    expect(hrRepository.replaceHrDocuments).toHaveBeenCalledWith(['old-doc'], uploadData);
    expect(cloudinaryUtils.destroyUploadedFile).toHaveBeenCalledWith(oldDoc.fileUrl);
  });

  it('does not touch the other ID side when replacing one side', async () => {
    // findHrDocumentsByProfileAndType is queried by exact documentType, so a
    // NATIONAL_ID_BACK document never appears in the NATIONAL_ID_FRONT lookup.
    vi.mocked(hrRepository.findHrDocumentsByProfileAndType).mockResolvedValue([]);
    vi.mocked(hrRepository.replaceHrDocuments).mockResolvedValue({ id: 'new-doc' } as never);

    await hrService.createHrDocument(uploadData);

    expect(hrRepository.findHrDocumentsByProfileAndType).toHaveBeenCalledWith(
      waiterProfile.id,
      'NATIONAL_ID_FRONT',
    );
  });

  it('keeps a case-linked document instead of deleting it', async () => {
    const linkedDoc = {
      id: 'linked-doc',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hr-documents/id-front-linked.jpg',
      disciplinaryRecordId: 'record-1',
      leaveRequestId: null,
    };
    vi.mocked(hrRepository.findHrDocumentsByProfileAndType).mockResolvedValue([linkedDoc as never]);
    vi.mocked(hrRepository.replaceHrDocuments).mockResolvedValue({ id: 'new-doc' } as never);

    await hrService.createHrDocument(uploadData);

    expect(hrRepository.replaceHrDocuments).toHaveBeenCalledWith([], uploadData);
    expect(cloudinaryUtils.destroyUploadedFile).not.toHaveBeenCalled();
  });

  it('does not replace for non-ID document types like CERTIFICATE (stays append-only)', async () => {
    vi.mocked(hrRepository.replaceHrDocuments).mockResolvedValue({ id: 'new-doc' } as never);

    const certData = { ...uploadData, documentType: 'CERTIFICATE' as const };
    await hrService.createHrDocument(certData);

    expect(hrRepository.findHrDocumentsByProfileAndType).not.toHaveBeenCalled();
    expect(hrRepository.replaceHrDocuments).toHaveBeenCalledWith([], certData);
  });
});
