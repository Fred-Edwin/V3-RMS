/**
 * The head's and member's Branch day phone calls (contract BD1 to BD10), typed with the frozen mirror. Components never call
 * `fetch`; they use these through their hooks. While the back end is unmerged the calls are answered by the mock
 * (`NEXT_PUBLIC_BRANCH_DAY_MOCK` is on unless set to "0"); once `feat/block4-be` is merged the default flips to the real API.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  AcceptOpeningInput,
  CountView,
  Home,
  MyDay,
  MyHistory,
  MyHistoryQuery,
  OpeningResult,
  OpeningView,
  RecountOpeningInput,
  RecountPreview,
  RecountPreviewInput,
  SaveCountInput,
  SaveCountResult,
  SignCountInput,
  SignCountResult,
} from '../../_shared/types/branch-day-contract';
import { branchDayPhoneMock } from './branch-day-phone-mock';

export interface BranchDayPhoneApi {
  /** BD1 */
  home: () => Promise<Home>;
  /** BD2 */
  opening: () => Promise<OpeningView>;
  /** BD3. No PIN. */
  acceptOpening: (input: AcceptOpeningInput) => Promise<OpeningResult>;
  /** BD4. Writes nothing. */
  recountPreview: (input: RecountPreviewInput) => Promise<RecountPreview>;
  /** BD5. PIN. */
  recount: (input: RecountOpeningInput) => Promise<OpeningResult>;
  /** BD6. Blind. */
  count: () => Promise<CountView>;
  /** BD7. Last write wins. */
  saveCount: (input: SaveCountInput) => Promise<SaveCountResult>;
  /** BD8. PIN. */
  signCount: (input: SignCountInput) => Promise<SignCountResult>;
  /** BD9 */
  myHistory: (query: MyHistoryQuery) => Promise<MyHistory>;
  /** BD10 */
  myDay: (id: string) => Promise<MyDay>;
}

const call = makeCallApi('/inventory/branch-day');

const realApi: BranchDayPhoneApi = {
  home: () => call<Home>('GET', '/home'),
  opening: () => call<OpeningView>('GET', '/opening'),
  acceptOpening: (input) => call<OpeningResult>('POST', '/opening/accept', input),
  recountPreview: (input) => call<RecountPreview>('POST', '/opening/recount/preview', input),
  recount: (input) => call<OpeningResult>('POST', '/opening/recount', input),
  count: () => call<CountView>('GET', '/count'),
  saveCount: (input) => call<SaveCountResult>('PUT', '/count', input),
  signCount: (input) => call<SignCountResult>('POST', '/count/sign', input),
  myHistory: (query) => call<MyHistory>('GET', `/mine/history${queryString(query)}`),
  myDay: (id) => call<MyDay>('GET', `/mine/days/${id}`),
};

export const branchDayMockOn = process.env.NEXT_PUBLIC_BRANCH_DAY_MOCK !== '0';

export const branchDayPhoneApi: BranchDayPhoneApi = branchDayMockOn ? branchDayPhoneMock : realApi;
