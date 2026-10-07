import type { LogWasteResult } from '../_shared/waste-contract';

export type { LogWasteInput, LogWasteResult, WasteItems } from '../_shared/waste-contract';

/** What the service hands the controller: the result, and whether it replays an earlier tap (HTTP 200 instead of 201). */
export type LogOutcome = { result: LogWasteResult; replayed: boolean };
