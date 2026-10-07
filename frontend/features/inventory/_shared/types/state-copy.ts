/**
 * The shape of one row of a states-kit copy table (loading, empty, error, permission). Rules from the design pass:
 * loading is a quiet skeleton with the line; empty says what will appear and offers the one action; error says what
 * failed, that nothing was lost, and offers Try again; permission says who can do it and never shows a disabled button
 * (the button is hidden).
 */
export interface StateCopy {
  loading: string;
  /** null when the screen has no empty state. */
  empty: string | null;
  error: string;
  /** null when the screen has no permission state. */
  permission: string | null;
}
