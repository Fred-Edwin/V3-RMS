import type { Request, Response } from 'express';
import { UnauthorizedError, ValidationError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { employeeSensitiveService } from '../employees/employee-sensitive-service';
import { employeesService } from '../employees/employees-service';
import { hireService } from '../hire/hire-service';
import { exitService } from '../lifecycle/exit-service';
import { movesService } from '../lifecycle/moves-service';
import { probationService } from '../lifecycle/probation-service';
import { payService } from '../pay/pay-service';
import { signInService } from '../sign-in/sign-in-service';
import {
  SignInSuggestQuerySchema,
  TemporaryPasswordBodySchema,
  ChangeParamsSchema,
  ContractSchema,
  CreateLoginSchema,
  DocumentParamsSchema,
  DocumentUploadSchema,
  DraftBodySchema,
  DuplicateQuerySchema,
  ExitChecklistSchema,
  ExitSchema,
  FileRequestSchema,
  HireBodySchema,
  IdParamsSchema,
  ListQuerySchema,
  LoanSchema,
  MoveParamsSchema,
  PageQuerySchema,
  PatchMeSchema,
  PayChangeDecisionSchema,
  PayChangeSchema,
  PayChangesQuerySchema,
  PayProfileSchema,
  ProbationDecisionSchema,
  ProbationNoteSchema,
  RehireSchema,
  RequestParamsSchema,
  RevealSchema,
  SummaryQuerySchema,
  TransferSchema,
  UpdateEmployeeSchema,
} from '../people-validators';

const subjectOf = (req: Request): AccessSubject => {
  const subject = req.workforceSubject ?? req.user;
  if (!subject) throw new UnauthorizedError('Authentication required');
  return subject;
};
const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const fileOf = (req: Request): Express.Multer.File => {
  if (!req.file) throw new ValidationError('No file was sent', 'FILE_REQUIRED');
  return req.file;
};

export const employeesController = {
  // ---- reads ----------------------------------------------------------------------------------
  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await employeesService.list(subjectOf(req), ListQuerySchema.parse(req.query)));
  },
  summary: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.summary(subjectOf(req), SummaryQuerySchema.parse(req.query).siteId));
  },
  lookups: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.lookups(subjectOf(req)));
  },
  duplicateCheck: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.duplicateCheck(subjectOf(req), DuplicateQuerySchema.parse(req.query)));
  },
  unlinkedAccounts: async (req: Request, res: Response): Promise<void> => {
    const { page, perPage } = PageQuerySchema.parse(req.query);
    res.status(200).json(await employeesService.unlinkedAccounts(subjectOf(req), page, perPage));
  },
  mine: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.getMine(subjectOf(req)));
  },
  file: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.getFile(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  pay: async (req: Request, res: Response): Promise<void> => {
    ok(res, await payService.view(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  documents: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeeSensitiveService.documents(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  openDocument: async (req: Request, res: Response): Promise<void> => {
    const { id, docId } = DocumentParamsSchema.parse(req.params);
    ok(res, await employeeSensitiveService.openDocument(subjectOf(req), id, docId));
  },
  payChanges: async (req: Request, res: Response): Promise<void> => {
    ok(res, await payService.listChanges(subjectOf(req), PayChangesQuerySchema.parse(req.query).status));
  },

  // ---- drafts and hire ------------------------------------------------------------------------
  listDrafts: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.listDrafts(subjectOf(req)));
  },
  createDraft: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.createDraft(subjectOf(req), DraftBodySchema.parse(req.body)), 201);
  },
  updateDraft: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.updateDraft(subjectOf(req), IdParamsSchema.parse(req.params).id, DraftBodySchema.parse(req.body)));
  },
  deleteDraft: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.deleteDraft(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  hire: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.hire(subjectOf(req), HireBodySchema.parse(req.body)), 201);
  },

  // ---- the file -------------------------------------------------------------------------------
  update: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.update(subjectOf(req), IdParamsSchema.parse(req.params).id, UpdateEmployeeSchema.parse(req.body)));
  },
  patchMe: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.patchMe(subjectOf(req), PatchMeSchema.parse(req.body)));
  },
  photo: async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id === undefined ? 'me' : IdParamsSchema.parse(req.params).id;
    ok(res, await employeesService.uploadPhoto(subjectOf(req), id, fileOf(req).buffer));
  },
  uploadDocument: async (req: Request, res: Response): Promise<void> => {
    const file = fileOf(req);
    const { documentType } = DocumentUploadSchema.parse(req.body);
    ok(res, await employeeSensitiveService.uploadDocument(subjectOf(req), IdParamsSchema.parse(req.params).id, { documentType, fileName: file.originalname, buffer: file.buffer }), 201);
  },
  reveal: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeeSensitiveService.reveal(subjectOf(req), IdParamsSchema.parse(req.params).id, RevealSchema.parse(req.body).field));
  },
  askForDetail: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.askForDetail(subjectOf(req), IdParamsSchema.parse(req.params).id, FileRequestSchema.parse(req.body).kind), 201);
  },
  remind: async (req: Request, res: Response): Promise<void> => {
    const { id, requestId } = RequestParamsSchema.parse(req.params);
    ok(res, await employeesService.remind(subjectOf(req), id, requestId));
  },
  verifyStatutory: async (req: Request, res: Response): Promise<void> => {
    ok(res, await employeesService.verifyStatutory(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  suggestSignIn: async (req: Request, res: Response): Promise<void> => {
    ok(res, await signInService.suggestEmail(subjectOf(req), SignInSuggestQuerySchema.parse(req.query).name));
  },
  newTemporaryPassword: async (req: Request, res: Response): Promise<void> => {
    ok(res, await signInService.newTemporaryPassword(subjectOf(req), TemporaryPasswordBodySchema.parse(req.body).employeeId), 201);
  },
  createLogin: async (req: Request, res: Response): Promise<void> => {
    ok(res, await hireService.createLogin(subjectOf(req), IdParamsSchema.parse(req.params).id, CreateLoginSchema.parse(req.body)));
  },

  // ---- pay ------------------------------------------------------------------------------------
  updatePayProfile: async (req: Request, res: Response): Promise<void> => {
    ok(res, await payService.updateProfile(subjectOf(req), IdParamsSchema.parse(req.params).id, PayProfileSchema.parse(req.body)));
  },
  requestPayChange: async (req: Request, res: Response): Promise<void> => {
    ok(res, await payService.requestChange(subjectOf(req), IdParamsSchema.parse(req.params).id, PayChangeSchema.parse(req.body)), 201);
  },
  decidePayChange: async (req: Request, res: Response): Promise<void> => {
    ok(res, await payService.decide(subjectOf(req), ChangeParamsSchema.parse(req.params).changeId, PayChangeDecisionSchema.parse(req.body)));
  },

  // ---- lifecycle ------------------------------------------------------------------------------
  createContract: async (req: Request, res: Response): Promise<void> => {
    ok(res, await probationService.createContract(subjectOf(req), IdParamsSchema.parse(req.params).id, ContractSchema.parse(req.body)), 201);
  },
  decideProbation: async (req: Request, res: Response): Promise<void> => {
    ok(res, await probationService.decideProbation(subjectOf(req), IdParamsSchema.parse(req.params).id, ProbationDecisionSchema.parse(req.body)));
  },
  probationNote: async (req: Request, res: Response): Promise<void> => {
    ok(res, await probationService.addProbationNote(subjectOf(req), IdParamsSchema.parse(req.params).id, ProbationNoteSchema.parse(req.body)));
  },
  previewTransfer: async (req: Request, res: Response): Promise<void> => {
    ok(res, await movesService.previewTransfer(subjectOf(req), IdParamsSchema.parse(req.params).id, TransferSchema.parse(req.body)));
  },
  transfer: async (req: Request, res: Response): Promise<void> => {
    ok(res, await movesService.transfer(subjectOf(req), IdParamsSchema.parse(req.params).id, TransferSchema.parse(req.body)), 201);
  },
  loan: async (req: Request, res: Response): Promise<void> => {
    ok(res, await movesService.loan(subjectOf(req), IdParamsSchema.parse(req.params).id, LoanSchema.parse(req.body)), 201);
  },
  cancelMove: async (req: Request, res: Response): Promise<void> => {
    const { id, moveId } = MoveParamsSchema.parse(req.params);
    ok(res, await movesService.cancelMove(subjectOf(req), id, moveId));
  },
  endMove: async (req: Request, res: Response): Promise<void> => {
    const { id, moveId } = MoveParamsSchema.parse(req.params);
    ok(res, await movesService.endMove(subjectOf(req), id, moveId));
  },
  previewExit: async (req: Request, res: Response): Promise<void> => {
    ok(res, await exitService.previewExit(subjectOf(req), IdParamsSchema.parse(req.params).id, ExitSchema.parse(req.body)));
  },
  exit: async (req: Request, res: Response): Promise<void> => {
    ok(res, await exitService.exit(subjectOf(req), IdParamsSchema.parse(req.params).id, ExitSchema.parse(req.body)));
  },
  exitChecklist: async (req: Request, res: Response): Promise<void> => {
    ok(res, await exitService.updateExitChecklist(subjectOf(req), IdParamsSchema.parse(req.params).id, ExitChecklistSchema.parse(req.body)));
  },
  undoExit: async (req: Request, res: Response): Promise<void> => {
    ok(res, await exitService.undoExit(subjectOf(req), IdParamsSchema.parse(req.params).id));
  },
  rehire: async (req: Request, res: Response): Promise<void> => {
    ok(res, await exitService.rehire(subjectOf(req), IdParamsSchema.parse(req.params).id, RehireSchema.parse(req.body)));
  },
};
