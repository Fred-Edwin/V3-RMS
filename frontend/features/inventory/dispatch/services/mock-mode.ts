/**
 * Back end D (deliveries V1 to V6, discrepancies Q1 to Q5) has not merged, so the desktop lane answers those from a hand-written
 * in-memory mock (`dispatch-mock-desktop.ts`). The mock is the default; set `NEXT_PUBLIC_DISPATCH_MOCK=off` to call the real API.
 * At integration the owner flips this default and the mock file is deleted. The store side (P1 to P10) is always real.
 */
export const MOCK_BRANCH_SIDE: boolean = process.env.NEXT_PUBLIC_DISPATCH_MOCK !== 'off';
