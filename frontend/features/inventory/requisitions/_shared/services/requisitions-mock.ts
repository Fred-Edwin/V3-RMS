/**
 * A hand-written mock of the Requisitions API, answering from the frozen contract fixtures. Used only when
 * `NEXT_PUBLIC_REQUISITIONS_MOCK=1`, until back end B lands. It is stateless: a write returns the fixture's result.
 */
import fixtures from '../types/requisitions-contract.fixtures.json';
import type {
  Activity,
  ApproveAdditionResult,
  ApproveResult,
  ApproveSummary,
  Badges,
  CancelResult,
  ChangeQuantityResult,
  Documents,
  ListRequisitions,
  ListRequisitionsQuery,
  NudgeResult,
  Print,
  RequisitionFile,
  SaveLinesInput,
  SectionDetail,
  SectionEdit,
  SendSectionResult,
  SetUrgentInput,
  SetUrgentResult,
  SkipSectionResult,
  StartRequisitionResult,
} from '../types/requisitions-contract';

const later = <T>(value: T): Promise<T> => new Promise((resolve) => window.setTimeout(() => resolve(structuredClone(value)), 120));

export const mockRequisitions = {
  list: (query: ListRequisitionsQuery): Promise<ListRequisitions> => {
    const base = (query.tab === 'collecting' ? fixtures.listHubCollecting : fixtures.listManager) as ListRequisitions;
    return later({ ...base, tab: query.tab ?? base.tab });
  },
  badges: (): Promise<Badges> => later(fixtures.badgesManager as Badges),
  file: (_id: string): Promise<RequisitionFile> => later(fixtures.fileManager as RequisitionFile),
  activity: (): Promise<Activity> => later(fixtures.activity as Activity),
  documents: (): Promise<Documents> => later(fixtures.documents as Documents),
  print: (): Promise<Print> => later(fixtures.print as Print),
  section: (): Promise<SectionEdit> => later(fixtures.sectionEdit as SectionEdit),
  approveSummary: (): Promise<ApproveSummary> => later(fixtures.approveSummary as ApproveSummary),
  start: (): Promise<StartRequisitionResult> => later(fixtures.startResult as StartRequisitionResult),
  saveLines: (_input: SaveLinesInput): Promise<SectionDetail> => later((fixtures.sectionEdit as SectionEdit).section),
  send: (): Promise<SendSectionResult> => later(fixtures.sendSectionResult as SendSectionResult),
  setUrgent: (input: SetUrgentInput): Promise<SetUrgentResult> => later({ ...(fixtures.setUrgentResult as SetUrgentResult), urgent: input.urgent }),
  changeQuantity: (): Promise<ChangeQuantityResult> => later(fixtures.changeQuantityResult as ChangeQuantityResult),
  nudge: (): Promise<NudgeResult> => later(fixtures.nudgeResult as NudgeResult),
  skip: (): Promise<SkipSectionResult> => later(fixtures.skipSectionResult as SkipSectionResult),
  approve: (): Promise<ApproveResult> => later(fixtures.approveResult as ApproveResult),
  cancel: (): Promise<CancelResult> => later(fixtures.cancelResult as CancelResult),
  approveAddition: (): Promise<ApproveAdditionResult> => later(fixtures.approveAdditionResult as ApproveAdditionResult),
};
