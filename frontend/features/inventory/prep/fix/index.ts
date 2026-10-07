/**
 * Prep · Fix a slip: public entry point of the sub-module (see README.md).
 *
 * For Slice 4's run drawer (plain props, no router inside):
 *  - `CorrectedCompare` ({ run }): the side-by-side body of a corrected run (Paper step 17).
 *  - `CancelRunDialog` ({ run, open, onClose, onDone, onLocked? }): "Cancel this run?" with the below-zero warning (Paper step 18).
 *  - `CorrectRunForm` ({ run, onDone, onLocked?, onDirtyChange? }): the correct form with its check sheet (Paper steps 14, 15).
 *  - `FixRunScreen` ({ run, onDone, onClose, step?, onStepChange? }): the whole Attendant flow for one run.
 * The route page uses `FixRunRoute` ({ runId }).
 */
export { CancelRunDialog } from './components/cancel-run-dialog';
export type { CancelRunDialogProps } from './components/cancel-run-dialog';
export { CorrectedCompare } from './components/corrected-compare';
export { CorrectRunForm } from './components/correct-run-form';
export type { CorrectRunFormProps } from './components/correct-run-form';
export { FixRunRoute, FixRunScreen } from './components/fix-run-screen';
export type { FixRunScreenProps, FixStep } from './components/fix-run-screen';
