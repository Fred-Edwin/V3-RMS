import type { HrDocumentType } from '@prisma/client';
import { uploadImageBuffer } from '../../../../utils/cloudinary';
import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiDateOf, toDateColumn } from '../../_shared/time/nairobi-time';
import { inScope, lockedGroupsFor, workforceCan, type AccessSubject, type SensitiveGroup } from '../../_shared/workforce-access';
import { targetOf } from '../people-access';
import { resolveActor, todayOf } from '../people-context';
import { SELF_UPLOADABLE_DOCUMENT_TYPES } from '../people.constants';
import type { DocumentRow } from '../people.types';
import { groupOfField, loadReadableRow, rawField } from './employee-file-view';
import { employeesRepository } from './employees-repository';

/**
 * The parts of a file that are sensitive to open: the clear value of an ID or bank field, and documents. Opening any of
 * them for someone else's file writes an audit entry; opening your own does not.
 */
export const employeeSensitiveService = {
  async documents(subject: AccessSubject, id: string): Promise<DocumentRow[] | { locked: SensitiveGroup[] }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    const locked = lockedGroupsFor(subject, targetOf(row));
    if (locked.includes('documents')) return { locked };
    const docs = await employeesRepository.documentsOf(row.id);
    const names = new Map((await employeesRepository.findUserNames([...new Set(docs.map((d) => d.uploadedById))])).map((u) => [u.id, u.name]));
    return docs.map((d) => ({ id: d.id, documentType: d.documentType, fileName: d.fileName, uploadedByName: names.get(d.uploadedById) ?? null, uploadedOn: nairobiDateOf(d.createdAt) }));
  },

  /** R10: the URL, behind an audit entry unless it is the person's own. */
  async openDocument(subject: AccessSubject, id: string, docId: string): Promise<{ url: string }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (lockedGroupsFor(subject, targetOf(row)).includes('documents')) throw new NotFoundError('Document not found');
    const doc = await employeesRepository.findDocument(row.id, docId);
    if (!doc) throw new NotFoundError('Document not found');
    if (row.userId !== subject.id) {
      await runAudited(async () => ({
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.document_opened',
            category: 'SENSITIVE_VIEW' as const,
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { documentType: doc.documentType },
          },
        ],
      }));
    }
    return { url: doc.fileUrl };
  },

  async uploadDocument(subject: AccessSubject, id: string, input: { documentType: HrDocumentType; fileName: string; buffer: Buffer }): Promise<DocumentRow> {
    const ctx = await resolveActor(subject);
    const row = await employeesRepository.findFileById(ctx.companyId, id, toDateColumn(todayOf()));
    if (!row) throw new NotFoundError('Employee not found');
    const target = targetOf(row);
    const own = row.userId !== null && row.userId === subject.id;
    if (inScope(subject, 'employee.write_sensitive', target)) {
      // HR may upload every document type.
    } else if (own && workforceCan(subject, 'me.file')) {
      if (!(SELF_UPLOADABLE_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
        throw new ForbiddenError(`Document type ${input.documentType} can only be uploaded by HR`, 'FIELD_NOT_ALLOWED');
      }
    } else {
      throw new NotFoundError('Employee not found');
    }
    const fileUrl = await uploadImageBuffer(input.buffer, 'hr-documents');
    return runAudited(async (tx) => {
      const doc = await employeesRepository.createDocument(tx, {
        employeeId: row.id,
        legacyProfileId: row.legacyProfileId,
        documentType: input.documentType,
        fileName: input.fileName,
        fileUrl,
        uploadedById: subject.id,
      });
      return {
        result: { id: doc.id, documentType: doc.documentType, fileName: doc.fileName, uploadedByName: ctx.name, uploadedOn: nairobiDateOf(doc.createdAt) },
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.document_uploaded',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { documentType: doc.documentType },
          },
        ],
      };
    });
  },

  /** W28: the clear value of one ID or bank field, behind an audit entry unless it is the person's own. */
  async reveal(subject: AccessSubject, id: string, field: string): Promise<{ field: string; value: string | null }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (lockedGroupsFor(subject, targetOf(row)).includes(groupOfField(field))) {
      throw new ForbiddenError('You do not have permission to see this', 'FIELD_NOT_ALLOWED');
    }
    const value = rawField(row, field);
    if (row.userId === subject.id) return { field, value };
    await runAudited(async () => ({
      result: null,
      entries: [
        {
          companyId: ctx.companyId,
          siteId: row.siteId,
          actor: ctx.auditActor,
          action: 'people.sensitive_revealed',
          category: 'SENSITIVE_VIEW' as const,
          subjectType: 'Employee',
          subjectId: row.id,
          subjectUserId: row.userId,
          after: { field },
        },
      ],
    }));
    return { field, value };
  },
};
