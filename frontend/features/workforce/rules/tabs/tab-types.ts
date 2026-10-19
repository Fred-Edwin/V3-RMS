import type * as React from 'react';

import type { AccessTableRow, RulesPage, SavedVersion } from '../types/rules-types';

/** What a row's Change dialog is given. The dialog closes itself by calling `onClose`; a save calls `onSaved` first. */
export interface EditorProps {
  page: RulesPage;
  onSaved: (saved: SavedVersion) => void;
  onStale: () => void;
  onClose: () => void;
}

/** One row of a tab's "THE RULE TODAY" panel. `id` is the server's row id (the catalogue in `access/access-catalogue.ts`). */
export interface RuleRowDef {
  id: string;
  title: string;
  /** What the row sets, for the padlock popover ("the grace period"). */
  thing: string;
  help: string | ((page: RulesPage) => string);
  /** The value in words. `mono` for numbers; `muted` for "Off". */
  value: (page: RulesPage) => { text: string; mono?: boolean; muted?: boolean };
  /** A richer value than words (the Overtime multiplier's confirmation lines). Replaces `value` on screen. */
  render?: (page: RulesPage) => React.ReactNode;
  /** The Change dialog. Left out = the system sets the row (it says Fixed whatever the server's kind). */
  Editor?: React.ComponentType<EditorProps>;
  /** Rows the Director/BM may hold as an own rule get the "Own rule" tag; Paper's grey fill for the pay multiplier. */
  tinted?: boolean;
}

/** What every tab body is given. */
export interface TabProps {
  page: RulesPage;
  access: AccessTableRow | null;
  onSaved: (saved: SavedVersion) => void;
  onStale: () => void;
  /** Read the tab again (after a confirm or a withdraw). */
  reload: () => void;
  /** Set when a company-wide viewer is looking at one site: where "back to the company rule" leads. */
  backHref?: string;
}
