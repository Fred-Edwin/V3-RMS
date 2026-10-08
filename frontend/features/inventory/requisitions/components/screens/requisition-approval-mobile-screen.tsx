'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { ErrorState } from '@/components/app/shell/shell-states';
import { SignSheetDialog, SignedBySignature } from '@/components/app/shell/sign-sheet';
import { useAuthStore } from '@/store/authStore';
import { useRequisitionApproval } from '../../hooks/use-requisition-approval';
import { RequisitionApprovalSkeletonMobile } from '../skeletons';
import type { ApprovalEdit } from '../../hooks/use-requisition-approval';
import type { DepartmentTag, RequisitionApprovalLine, RequisitionApprovalSection } from '../../types';

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function requisitionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

/** "13:40" from an ISO timestamp — matches Paper's HH:mm subtitle captions. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * First name + last initial, e.g. "Grace Wanjiru" -> "Grace W." — matches
 * Paper's `17SM-0` copy ("Sends Kitchen back to Grace W...", "NOTE TO GRACE
 * W."). Dev seed names carry a parenthetical branch suffix; strip it first.
 */
function firstNameLastInitial(name: string | null): string {
  if (!name) return 'the head';
  const withoutParenthetical = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = (withoutParenthetical || name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

function BackHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-wds-border px-4">
      <button type="button" onClick={onBack} aria-label="Back" className="shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="var(--wds-text-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex grow flex-col gap-0.5">
        <div className="font-wds-sans text-[17px]/[19px] font-semibold text-wds-text-ink">{title}</div>
        <div className="font-wds-sans text-wds-caption/label text-wds-text-faint">{subtitle}</div>
      </div>
    </div>
  );
}

interface EditSheetState {
  line: RequisitionApprovalLine;
  departmentTag: DepartmentTag;
}

/** M4 — editing a line, bottom sheet (Paper `17GW-0`): qty stepper + required reason textarea. */
function EditLineSheet({
  state,
  onClose,
  onSave,
}: {
  state: EditSheetState;
  onClose: () => void;
  onSave: (departmentTag: DepartmentTag, lineId: string, edit: ApprovalEdit) => void;
}) {
  const [qty, setQty] = React.useState(state.line.approvedQty ?? state.line.requestedQty ?? '0');
  const [reason, setReason] = React.useState(state.line.editReason ?? '');
  const [touched, setTouched] = React.useState(false);
  const invalid = touched && reason.trim().length === 0;

  const step = (delta: number) => {
    const n = Number.parseFloat(qty || '0');
    setQty(String(Math.max(0, n + delta)));
  };

  const save = () => {
    if (reason.trim().length === 0) {
      setTouched(true);
      return;
    }
    onSave(state.departmentTag, state.line.id, { approvedQty: qty, editReason: reason });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#17151273]" onClick={onClose}>
      <div
        className="flex flex-col gap-[18px] rounded-t-[12px] bg-wds-surface px-4 pb-9 pt-2.5 [box-shadow:#0000001F_0px_-4px_24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <div className="h-1 w-9 shrink-0 rounded-full bg-wds-border-strong" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">{state.line.itemName}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">
            {state.line.categoryName ?? ''} · on hand — · par {state.line.parAtRequest ?? '—'} · head asked {state.line.requestedQty ?? '—'}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-wds-sans text-wds-caption font-medium uppercase tracking-wds-label text-wds-text-faint">
            Approved quantity
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} className="flex size-11 shrink-0 items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="text-[20px]/6 text-wds-text-ink">–</span>
            </button>
            <div className="flex h-11 grow items-center justify-center rounded-wds-sm border border-wds-primary bg-wds-caramel-100">
              <span className="font-wds-mono text-[17px]/[22px] font-medium text-wds-primary">
                {qty} {state.line.usageUnit}
              </span>
            </div>
            <button type="button" onClick={() => step(1)} className="flex size-11 shrink-0 items-center justify-center rounded-wds-sm border border-wds-border-strong">
              <span className="text-[20px]/6 text-wds-text-ink">+</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1.5">
            <div className="font-wds-sans text-wds-caption font-medium uppercase tracking-wds-label text-wds-text-faint">
              Reason for change
            </div>
            <div className="font-wds-sans text-wds-caption text-wds-error-fg">required</div>
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={invalid} rows={3} />
          {invalid ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">A reason is required.</p> : null}
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" className="grow" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="grow" onClick={save}>
            Save line
          </Button>
        </div>
      </div>
    </div>
  );
}

/** M7 — return section, bottom sheet (Paper `17SM-0`). */
function ReturnSectionSheet({
  departmentTag,
  submittedByName,
  onClose,
  onReturn,
}: {
  departmentTag: DepartmentTag;
  submittedByName: string | null;
  onClose: () => void;
  onReturn: (departmentTag: DepartmentTag, note: string) => void;
}) {
  const [note, setNote] = React.useState('');
  const headShortName = firstNameLastInitial(submittedByName);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#17151273]" onClick={onClose}>
      <div className="flex flex-col gap-4 rounded-t-[12px] bg-wds-surface px-4 pb-9 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <div className="h-1 w-9 shrink-0 rounded-full bg-wds-border-strong" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">Return this section</div>
          <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Sends {DEPARTMENT_LABEL[departmentTag]} back to {headShortName} with your note. They&apos;ll need to resubmit.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1.5">
            <div className="font-wds-sans text-wds-caption font-medium uppercase tracking-wds-label text-wds-text-faint">
              Note to {headShortName}
            </div>
            <div className="font-wds-sans text-wds-caption text-wds-error-fg">required</div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. "Qty seems high for today — please confirm before resubmitting."'
            rows={3}
          />
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" className="grow" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="grow"
            disabled={note.trim().length === 0}
            onClick={() => {
              onReturn(departmentTag, note.trim());
              onClose();
            }}
          >
            Return section
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileSectionBlock({
  section,
  lines,
  readOnly,
  onEditLine,
  onFillMyself,
  onNudge,
  onReturnRequest,
}: {
  section: RequisitionApprovalSection;
  lines: RequisitionApprovalLine[];
  readOnly: boolean;
  onEditLine: (line: RequisitionApprovalLine) => void;
  onFillMyself: (tag: DepartmentTag) => void;
  onNudge: (tag: DepartmentTag) => void;
  onReturnRequest: (tag: DepartmentTag) => void;
}) {
  const [expanded, setExpanded] = React.useState(!section.isAsRequested);

  if (section.status === 'NOT_STARTED' || section.status === 'DRAFT' || section.status === 'RETURNED') {
    return (
      <div className="flex flex-col gap-3 border-t border-wds-border bg-wds-neutral-50 p-4">
        <div className="flex items-baseline gap-2">
          <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">
            {section.status === 'RETURNED' ? `returned — ${section.returnedNote}` : 'not submitted'}
          </div>
        </div>
        {!readOnly ? (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => onFillMyself(section.departmentTag)}>
              Fill it myself
            </Button>
            <Button variant="secondary" onClick={() => onNudge(section.departmentTag)}>
              Nudge head
            </Button>
            <Button variant="secondary" disabled className="opacity-55">
              Send without
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (section.isAsRequested && !expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="flex items-center justify-between border-t border-wds-border px-4 py-3.5 text-left">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
            <div className="font-wds-sans text-wds-caption text-wds-text-faint">as requested</div>
          </div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">
            {section.submittedByName} · {section.lines.length} lines · {section.totalUnits} units
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L9 7L5 10.5" stroke="var(--wds-text-faint)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col border-t border-wds-border">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-baseline gap-2">
          <div className="font-wds-sans text-[17px]/[22px] font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
          {section.changedLineCount > 0 ? (
            <div className="font-wds-sans text-wds-caption font-medium text-wds-primary">{section.changedLineCount} line changed</div>
          ) : null}
        </div>
      </div>
      <div className="px-4 pb-2.5 font-wds-sans text-wds-caption text-wds-text-faint">
        {section.submittedByName} · submitted · {section.lines.length} lines
      </div>
      {lines.map((line) => (
        <button
          key={line.id}
          type="button"
          disabled={readOnly}
          onClick={() => onEditLine(line)}
          className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-3 text-left disabled:pointer-events-none"
        >
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <div className="line-clamp-1 font-wds-sans text-wds-body font-medium text-wds-text-ink">{line.itemName}</div>
            <div className="font-wds-sans text-wds-caption text-wds-text-faint">
              {line.requestedQty === null ? 'added from note' : `par ${line.parAtRequest ?? '—'} ${line.usageUnit}`}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="font-wds-mono text-wds-body text-wds-text-copy-muted">{line.requestedQty ?? '—'}</div>
            {!readOnly ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="var(--wds-text-faint)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ) : null}
            <div
              className={
                'flex min-w-11 h-8 items-center justify-center rounded-wds-sm border px-2.5 ' +
                (line.isEdited ? 'border-wds-primary bg-wds-caramel-100 text-wds-primary' : 'border-wds-border-strong text-wds-text-ink')
              }
            >
              <span className="font-wds-mono text-wds-body font-medium">{line.approvedQty ?? '—'}</span>
            </div>
          </div>
        </button>
      ))}
      {!readOnly ? (
        <div className="flex items-center justify-between px-4 py-3.5">
          <button type="button" className="font-wds-sans text-wds-body font-medium text-wds-primary">
            + Add a line
          </button>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">Section total: {section.totalUnits} units</div>
        </div>
      ) : null}
      {!readOnly ? (
        <button
          type="button"
          onClick={() => onReturnRequest(section.departmentTag)}
          className="border-b border-wds-border px-4 pb-3 text-left font-wds-sans text-wds-caption font-medium text-wds-error-fg"
        >
          Return this section
        </button>
      ) : null}
    </div>
  );
}

export interface RequisitionApprovalMobileScreenProps {
  requisitionId: string;
}

/**
 * M3/M5/M6/M7/M8 — Branch Manager mobile requisition review (Paper `17D7-0`
 * family, M3-b row shape). M9 (error) and M10 (loading) render inline via
 * the same status branches the desktop screen uses.
 */
export function RequisitionApprovalMobileScreen({ requisitionId }: RequisitionApprovalMobileScreenProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    requisition,
    visibleLinesBySection,
    setLineEdit,
    saveSection,
    returnSection,
    nudgeHead,
    approve,
    approving,
    approveError,
    status,
    error,
    reload,
  } = useRequisitionApproval(requisitionId);

  const [editSheet, setEditSheet] = React.useState<EditSheetState | null>(null);
  const [returnSheetTag, setReturnSheetTag] = React.useState<DepartmentTag | null>(null);
  const [signOpen, setSignOpen] = React.useState(false);

  const isReadOnly = requisition?.status === 'APPROVED';
  const isAlreadyApprovedRace = Boolean(approveError) && requisition?.status === 'APPROVED';

  // Paper `17OY-0`/`17WI-0`'s "Changes from what was requested" summary —
  // same client-side derivation as the desktop screen (`requisition-approval-
  // screen.tsx`), since `isEdited`/`requestedQty`/`approvedQty` are already
  // on the detail payload.
  const changeSummaryLines: { departmentTag: DepartmentTag; text: string }[] = [];
  if (requisition) {
    for (const section of requisition.sections) {
      const edited = section.lines.filter((l) => l.isEdited);
      if (edited.length === 0) continue;
      const parts = edited.map((l) => {
        const approved = l.approvedQty === null ? '—' : `${l.approvedQty} ${l.usageUnit}`;
        if (l.requestedQty === null) return `added ${l.itemName} · ${approved}`;
        return `${l.itemName} ${l.requestedQty} → ${approved}`;
      });
      changeSummaryLines.push({ departmentTag: section.departmentTag, text: parts.join('; ') });
    }
  }

  const handleSaveEdit = async (departmentTag: DepartmentTag, lineId: string, edit: ApprovalEdit) => {
    setLineEdit(lineId, edit);
    await saveSection(departmentTag, { pendingEdit: { lineId, edit } });
  };

  const handleApprove = async (pin: string) => {
    const ok = await approve(pin);
    if (ok) setSignOpen(false);
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <RequisitionApprovalSkeletonMobile />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <ErrorState title="Couldn't load this requisition" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  if (!requisition) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <BackHeader
        title={requisitionTypeLabel(requisition.type)}
        subtitle={
          isReadOnly
            ? requisition.approvedByName === user?.name
              ? `Approved ${requisition.approvedAt ? formatTime(requisition.approvedAt) : ''} · signed by you`
              : `Approved ${requisition.approvedAt ? formatTime(requisition.approvedAt) : ''} · read-only`
            : `Opened ${formatTime(requisition.openedAt)} · ${requisition.sections.filter((s) => s.status === 'SUBMITTED').length} of ${requisition.sections.length} in`
        }
        onBack={() => router.push('/app/branch/requisitions')}
      />

      {isAlreadyApprovedRace ? (
        <div className="mx-4 mt-3 rounded-wds-sm border border-wds-info-border bg-wds-info-bg px-3.5 py-2.5">
          <div className="font-wds-sans text-wds-caption text-wds-info-fg">
            This requisition was already approved by another signer before you opened it. It&apos;s shown here read-only.
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3.5 overflow-x-auto border-b border-wds-border px-4 py-3">
        <div className="flex shrink-0 items-baseline gap-[5px]">
          <span className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
            {requisition.sections.filter((s) => s.status === 'SUBMITTED').length}/{requisition.sections.length}
          </span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">sections</span>
        </div>
        <div className="h-3.5 w-px shrink-0 bg-wds-border" />
        <div className="flex shrink-0 items-baseline gap-[5px]">
          <span className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
            {requisition.sections.reduce((sum, s) => sum + s.lines.length, 0)}
          </span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">lines</span>
        </div>
        <div className="h-3.5 w-px shrink-0 bg-wds-border" />
        <div className="flex shrink-0 items-baseline gap-[5px]">
          <span className="font-wds-sans text-wds-section font-semibold text-wds-primary">
            {requisition.sections.reduce((sum, s) => sum + s.changedLineCount, 0)}
          </span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">changed</span>
        </div>
        <div className="h-3.5 w-px shrink-0 bg-wds-border" />
        <div className="flex shrink-0 items-baseline gap-[5px]">
          <span className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">
            {requisition.sections.reduce((sum, s) => sum + Number(s.totalUnits), 0)}
          </span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">units</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[140px]">
        {requisition.sections.map((section) => (
          <MobileSectionBlock
            key={section.departmentTag}
            section={section}
            lines={visibleLinesBySection[section.departmentTag] ?? section.lines}
            readOnly={Boolean(isReadOnly)}
            onEditLine={(line) => setEditSheet({ line, departmentTag: section.departmentTag })}
            onFillMyself={(tag) => void saveSection(tag, { fillMyself: true })}
            onNudge={(tag) => void nudgeHead(tag)}
            onReturnRequest={(tag) => setReturnSheetTag(tag)}
          />
        ))}

        {isReadOnly && changeSummaryLines.length > 0 ? (
          <div className="mx-4 mt-2 flex flex-col gap-2 rounded-wds-sm bg-wds-neutral-50 p-4">
            <div className="font-wds-sans text-wds-caption font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
              Changes from what was requested
            </div>
            {changeSummaryLines.map((entry) => (
              <div key={entry.departmentTag} className="flex flex-col gap-0.5">
                <div className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{DEPARTMENT_LABEL[entry.departmentTag]} —</div>
                <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{entry.text}</div>
              </div>
            ))}
          </div>
        ) : null}

        {isReadOnly && requisition.approvedByName ? (
          <div className="mx-4 mb-6 mt-5 flex flex-col gap-3 border-t border-wds-neutral-800 pt-5">
            <SignedBySignature
              name={requisition.approvedByName}
              roleLine={`${requisition.approvedByName} · Branch Manager · signed ${requisition.approvedAt ? formatTime(requisition.approvedAt) : ''}`}
            />
            <div className="flex w-fit items-center gap-1.5 rounded-wds-sm border border-wds-success-border bg-wds-success-bg px-3 py-1.5">
              <div className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
              <div className="font-wds-sans text-wds-caption font-medium text-wds-success-fg">Sent to Central Store</div>
            </div>
          </div>
        ) : null}
      </div>

      {!isReadOnly ? (
        <div className="fixed bottom-0 left-0 flex w-full flex-col gap-2.5 border-t border-wds-border bg-wds-surface px-4 pb-9 pt-3.5">
          <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            One signature covers the whole requisition. Affected heads are notified after signing.
          </div>
          <Button className="h-[46px]" onClick={() => setSignOpen(true)}>
            Approve &amp; sign
          </Button>
        </div>
      ) : null}

      {editSheet ? (
        <EditLineSheet state={editSheet} onClose={() => setEditSheet(null)} onSave={handleSaveEdit} />
      ) : null}

      {returnSheetTag ? (
        <ReturnSectionSheet
          departmentTag={returnSheetTag}
          submittedByName={requisition?.sections.find((s) => s.departmentTag === returnSheetTag)?.submittedByName ?? null}
          onClose={() => setReturnSheetTag(null)}
          onReturn={(tag, note) => void returnSection(tag, note)}
        />
      ) : null}

      <SignSheetDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sign to approve"
        subtitle={`Enter your PIN to approve and sign ${requisitionTypeLabel(requisition.type)}.`}
        helperText={`Signing as ${user?.name ?? ''}, Branch Manager`}
        confirmLabel="Confirm"
        onSubmit={handleApprove}
        submitting={approving}
        error={approveError && !isAlreadyApprovedRace ? approveError : undefined}
      />
    </div>
  );
}
