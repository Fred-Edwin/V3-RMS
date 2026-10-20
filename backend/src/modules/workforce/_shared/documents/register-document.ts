import type { Prisma } from '@prisma/client';
import { ConflictError, ValidationError } from '../../../../utils/errors';
import { KIND_INFO, isWellFormedNumber, DOCUMENT_KINDS } from './document-kinds';
import { documentsRepository } from './documents-repository';
import { hashPrefixOf } from './qr-hash';
import type { RegisterDocumentInput, RegisteredDocument } from './documents.types';

const HEX64 = /^[0-9a-f]{64}$/;
/** A pay figure in a title or period would reach the public-facing index and notifications; the door refuses one. */
const LOOKS_LIKE_MONEY = /\bKES\b|\d{1,3}(,\d{3})+(\.\d+)?|\d+\.\d{2}\b/i;

function assertValid(input: RegisterDocumentInput, version: number): void {
  if (!DOCUMENT_KINDS.includes(input.kind)) throw new ValidationError(`Unknown document kind: ${input.kind}`, 'DOCUMENT_KIND_UNKNOWN');
  if (!isWellFormedNumber(input.kind, input.number)) throw new ValidationError(`Not a ${input.kind} number: ${input.number}`, 'DOCUMENT_NUMBER_INVALID');
  if (!Number.isInteger(version) || version < 1) throw new ValidationError('A document version starts at 1.', 'DOCUMENT_VERSION_INVALID');
  if (!HEX64.test(input.hash)) throw new ValidationError('The document hash must be a sha256 in hex.', 'DOCUMENT_HASH_INVALID');
  if (input.signedBy.name.trim() === '') throw new ValidationError('A signed document needs the signer.', 'DOCUMENT_SIGNER_MISSING');
  for (const text of [input.title ?? '', input.about]) {
    if (LOOKS_LIKE_MONEY.test(text)) throw new ValidationError('A document title or period never carries an amount.', 'DOCUMENT_TEXT_HAS_AMOUNT');
  }
}

const searchTextOf = (input: RegisterDocumentInput, title: string): string =>
  [input.number, title, input.about, input.signedBy.name, input.reviewedBy?.name ?? '', input.kind].join(' ').toLowerCase().slice(0, 400);

/**
 * THE documents door (6c D1). The issuer calls this INSIDE its own transaction, after the document is signed and numbered (never for
 * a draft: no number, no QR). One row per (company, number, version) in the read model behind the Signed documents index and the
 * verify page. Registering version 2 marks version 1 REPLACED in the same call. A repeat of the same call is a no-op; the same number
 * and version with a different hash is refused (409), because a printed QR must keep meaning one thing.
 *
 * Leave (`LVE`) and Conduct (`WRN`) call it from their signing transaction; the existing issuers are indexed by the reconciliation
 * (`documents/reconcile`), which calls this same door.
 */
export async function registerDocument(tx: Prisma.TransactionClient, input: RegisterDocumentInput): Promise<RegisteredDocument> {
  const version = input.version ?? 1;
  assertValid(input, version);
  const title = input.title ?? KIND_INFO[input.kind].label;
  const created = await documentsRepository.insertIfAbsent(tx, {
    companyId: input.companyId,
    siteId: input.siteId,
    kind: input.kind,
    number: input.number,
    version,
    title,
    about: input.about,
    subjectUserId: input.subjectUserId ?? null,
    signedById: input.signedBy.id,
    signedByName: input.signedBy.name,
    signedByRole: input.signedBy.role,
    reviewedById: input.reviewedBy?.id ?? null,
    reviewedByName: input.reviewedBy?.name ?? null,
    reviewedByRole: input.reviewedBy?.role ?? null,
    reviewedAt: input.reviewedBy?.at ?? null,
    signedAt: input.signedAt,
    method: 'PIN',
    hashPrefix: hashPrefixOf(input.hash),
    hash: input.hash,
    openHref: input.openHref,
    searchText: searchTextOf(input, title),
  });
  const row = await documentsRepository.find(tx, input.companyId, input.number, version);
  if (!row) throw new Error('A registered document disappeared inside its own transaction');
  if (!created && row.hash !== input.hash) {
    throw new ConflictError(`${input.number} version ${version} is already registered with a different hash.`, 'DOCUMENT_ALREADY_REGISTERED');
  }
  if (created) {
    // The newest version wins: an older one registered late (a reconciliation) is replaced by what is already there.
    const newest = await documentsRepository.maxVersion(tx, input.companyId, input.number);
    await documentsRepository.markReplaced(tx, input.companyId, input.number, newest, input.signedAt);
  }
  return { id: row.id, number: row.number, version: row.version, created };
}

export interface WithdrawDocumentInput {
  companyId: string;
  number: string;
  /** The role that withdrew it: the verify page says "by the Accountant", never a name. */
  byRole: string;
  at: Date;
  /** Set when a replacement was issued under another number. */
  replacedByNumber?: string | null;
}

/** A document voided or withdrawn (a casual sheet voided, a notice withdrawn). Every version of the number reads WITHDRAWN from now on. */
export async function withdrawDocument(tx: Prisma.TransactionClient, input: WithdrawDocumentInput): Promise<number> {
  const result = await documentsRepository.markWithdrawn(tx, input.companyId, input.number, input.at, input.byRole, input.replacedByNumber ?? null);
  return result.count;
}
