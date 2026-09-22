'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { SignSheetDialog, SignedBySignature } from '@/components/app/shell/sign-sheet';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRequisitionApproval } from '../../hooks/use-requisition-approval';
import { useRequisitionsForApproval } from '../../hooks/use-requisitions-for-approval';
import { EditReasonPopover } from '../edit-reason-popover';
import { RequisitionApprovalSkeletonDesktop, RequisitionsKpiSkeletonDesktop, RequisitionsListRailSkeletonDesktop } from '../skeletons';
import { PRINT_HANDOFF_KEY, type PrintableRequisitionProps } from '../printable-requisition-handoff';
import type { ApprovalEdit } from '../../hooks/use-requisition-approval';
import type { DepartmentTag, RequisitionApprovalDetail, RequisitionApprovalLine, RequisitionApprovalSection } from '../../types';

/** "06:12" from an ISO timestamp, Nairobi-local (matches Paper's HH:mm captions). */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function requisitionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

interface LineRowProps {
  line: RequisitionApprovalLine;
  originalRequestedQty: string | null;
  onEdit: (line: RequisitionApprovalLine, anchor: HTMLElement) => void;
  readOnly: boolean;
}

function LineRow({ line, originalRequestedQty, onEdit, readOnly }: LineRowProps) {
  const anchorRef = React.useRef<HTMLDivElement & HTMLButtonElement>(null);
  // Server-computed, not re-derived here: `approvedQty === null` (not yet
  // reviewed) must render as unedited, not as "changed from N" — matching
  // the server's own isEdited semantics (requisitions-service.ts).
  const isEdited = line.isEdited;
  const requestedDisplay = line.requestedQty === null ? '—' : `${line.requestedQty}`;
  const approvedDisplay = line.approvedQty === null ? '—' : `${line.approvedQty} ${line.usageUnit}`;

  return (
    <div className="flex items-center border-b border-b-wds-neutral-200 py-[7px]">
      <div className="flex min-w-0 grow basis-0 items-baseline gap-1.5 overflow-hidden">
        <span className="w-[76px] shrink-0 font-wds-sans text-[10px]/3 font-medium uppercase tracking-[0.05em] text-wds-text-faint">
          {(line.categoryName ?? '').toUpperCase()} ·
        </span>
        <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{line.itemName}</span>
        {line.requestedQty === null && !isEdited ? (
          <span className="text-[10px]/3 font-wds-sans text-wds-text-faint">added from note</span>
        ) : null}
        {line.editReason ? (
          <span className="min-w-0 flex-1 grow basis-0 truncate font-wds-sans text-wds-caption text-wds-text-faint underline decoration-dotted decoration-wds-border-strong underline-offset-2">
            — &quot;{line.editReason}&quot;
          </span>
        ) : null}
      </div>
      <div className="w-[70px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-faint">—</div>
      <div className="w-[60px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-faint">
        {line.parAtRequest ?? '—'}
      </div>
      <div
        className={
          'w-20 shrink-0 text-right font-wds-mono text-wds-body-sm ' +
          (isEdited ? 'text-wds-text-faint line-through decoration-1' : 'text-wds-text-muted')
        }
      >
        {requestedDisplay}
      </div>
      <div className="w-24 shrink-0">
        {readOnly ? (
          <div className="text-right font-wds-mono text-wds-body-sm text-wds-text-ink">{approvedDisplay}</div>
        ) : isEdited ? (
          <button
            ref={anchorRef}
            type="button"
            onClick={(e) => onEdit(line, e.currentTarget)}
            className="ml-auto flex w-[68px] items-center gap-1 rounded-wds-sm border border-wds-primary bg-wds-surface px-wds-2 py-[3px]"
          >
            <span className="grow basis-0 text-right font-wds-mono text-wds-body-sm font-medium text-wds-primary">
              {line.approvedQty ?? '—'}
            </span>
            <span className="font-wds-sans text-wds-caption text-wds-text-faint">{line.usageUnit}</span>
          </button>
        ) : (
          <div ref={anchorRef} className="text-right">
            <button
              type="button"
              onClick={(e) => onEdit(line, e.currentTarget)}
              className="font-wds-mono text-wds-body-sm text-wds-text-ink"
            >
              {originalRequestedQty ?? '—'} {line.usageUnit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionBlockProps {
  section: RequisitionApprovalSection;
  lines: RequisitionApprovalLine[];
  originalRequestedQtyByLineId: Record<string, string | null>;
  onEditLine: (line: RequisitionApprovalLine, anchor: HTMLElement) => void;
  onFillMyself: (departmentTag: DepartmentTag) => void;
  onNudge: (departmentTag: DepartmentTag) => void;
  onReturn: (departmentTag: DepartmentTag, note: string) => void;
  savingSection: DepartmentTag | null;
  nudgingSection: DepartmentTag | null;
  readOnly: boolean;
}

/**
 * First name + last initial, e.g. "Grace Wanjiru" -> "Grace W." — matches
 * Paper's `1415-0` header copy. Dev seed names carry a parenthetical branch
 * suffix ("Dev Chef 1 (King'ong'o)"); strip it before taking the initial so
 * that suffix's leading "(" doesn't become the "initial".
 */
function firstNameLastInitial(name: string | null): string {
  if (!name) return 'the head';
  const withoutParenthetical = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = (withoutParenthetical || name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Inline return-note panel (Paper `1415-0`) — replaces the section's line
 * rows while the manager is composing a return reason, desktop's equivalent
 * of the mobile `ReturnSectionSheet` bottom sheet. Not a native
 * `window.prompt` (that was the pre-fidelity-pass placeholder).
 */
function ReturnNotePanel({
  submittedByName,
  note,
  onNoteChange,
  onCancel,
  onConfirm,
}: {
  submittedByName: string | null;
  note: string;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-4 py-3.5">
      <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-error-fg">
        Return to {firstNameLastInitial(submittedByName)} — note required
      </div>
      <Textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder='e.g. "Qty seems high for today — please confirm before resubmitting."'
        rows={2}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" disabled={note.trim().length === 0} onClick={onConfirm}>
          Return section
        </Button>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  lines,
  originalRequestedQtyByLineId,
  onEditLine,
  onFillMyself,
  onNudge,
  onReturn,
  savingSection,
  nudgingSection,
  readOnly,
}: SectionBlockProps) {
  const [expanded, setExpanded] = React.useState(!section.isAsRequested);
  const [returning, setReturning] = React.useState(false);
  const [returnNote, setReturnNote] = React.useState('');
  const totalUnits = section.totalUnits;

  if (section.status === 'NOT_STARTED' || section.status === 'DRAFT' || section.status === 'RETURNED') {
    return (
      <div className="flex items-baseline justify-between border-t border-t-dashed border-t-wds-neutral-800 pt-4">
        <div className="flex items-baseline gap-2.5">
          <div
            className={
              'font-wds-sans text-[15px]/[22px] ' +
              (section.status === 'RETURNED' ? 'font-semibold text-wds-text-ink' : 'font-medium text-wds-text-faint')
            }
          >
            {DEPARTMENT_LABEL[section.departmentTag]}
          </div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">
            {section.status === 'RETURNED' ? `returned — ${section.returnedNote}` : 'not submitted'}
          </div>
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={savingSection === section.departmentTag}
              onClick={() => onFillMyself(section.departmentTag)}
            >
              Fill it myself
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={nudgingSection === section.departmentTag}
              onClick={() => onNudge(section.departmentTag)}
            >
              Nudge head
            </Button>
            <Button variant="secondary" size="sm" disabled title="Not built this milestone — approve already ignores unsubmitted sections">
              Send without
            </Button>
          </div>
        ) : (
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">Not included in this requisition</div>
        )}
      </div>
    );
  }

  if (section.isAsRequested && !expanded) {
    return (
      <div className="flex flex-col border-t border-t-solid border-t-wds-neutral-800 pt-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2.5">
            <button type="button" onClick={() => setExpanded(true)} className="font-wds-sans text-[15px]/[22px] font-medium text-wds-text-ink">
              {DEPARTMENT_LABEL[section.departmentTag]}
            </button>
            <div className="font-wds-sans text-wds-caption text-wds-text-faint">as requested</div>
          </div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint underline decoration-wds-border-strong underline-offset-2">
            {section.submittedByName} · {section.lines.length} lines · {totalUnits} units
          </div>
          {!readOnly && !returning ? (
            <button
              type="button"
              onClick={() => setReturning(true)}
              className="font-wds-sans text-wds-caption font-medium text-wds-error-fg underline decoration-wds-error-border underline-offset-2"
            >
              Return this section
            </button>
          ) : null}
        </div>
        {returning ? (
          <ReturnNotePanel
            submittedByName={section.submittedByName}
            note={returnNote}
            onNoteChange={setReturnNote}
            onCancel={() => {
              setReturning(false);
              setReturnNote('');
            }}
            onConfirm={() => onReturn(section.departmentTag, returnNote.trim())}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-t-solid border-t-wds-neutral-800 pt-[18px]">
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2.5">
          <div className="font-wds-sans text-[17px]/[22px] font-semibold text-wds-text-ink">{DEPARTMENT_LABEL[section.departmentTag]}</div>
          {section.changedLineCount > 0 ? (
            <div className="font-wds-sans text-wds-caption font-medium text-wds-primary">
              {section.changedLineCount} line{section.changedLineCount === 1 ? '' : 's'} changed
            </div>
          ) : null}
        </div>
        <div className="font-wds-sans text-wds-caption text-wds-text-faint">
          {section.submittedByName} · submitted {section.submittedAt ? formatTime(section.submittedAt) : '—'} · {section.lines.length} lines
        </div>
        {!readOnly && !returning ? (
          <button
            type="button"
            onClick={() => setReturning(true)}
            className="font-wds-sans text-wds-caption font-medium text-wds-error-fg underline decoration-wds-error-border underline-offset-2"
          >
            Return this section
          </button>
        ) : null}
      </div>
      {returning ? (
        <ReturnNotePanel
          submittedByName={section.submittedByName}
          note={returnNote}
          onNoteChange={setReturnNote}
          onCancel={() => {
            setReturning(false);
            setReturnNote('');
          }}
          onConfirm={() => onReturn(section.departmentTag, returnNote.trim())}
        />
      ) : (
        <>
          {lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              originalRequestedQty={originalRequestedQtyByLineId[line.id] ?? null}
              onEdit={onEditLine}
              readOnly={readOnly}
            />
          ))}
          {!readOnly ? (
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="font-wds-sans text-wds-caption font-medium text-wds-primary">
                + Add a line
              </button>
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">Section total: {totalUnits} units</div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-end">
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">Section total: {totalUnits} units</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface RequisitionApprovalScreenProps {
  requisitionId: string;
}

/**
 * Branch Manager desktop master-detail (`12HK-0` family) — list rail +
 * detail column. Measured from Paper via `get_jsx`/`get_computed_styles`:
 * sidebar 236px, list column 380px `flex-shrink-0` + `border-right`, detail
 * `flex-1 min-w-0`. Item/On hand(70px)/Par(60px)/Requested(80px)/
 * Approved(96px) columns, right-aligned font-mono.
 */
export function RequisitionApprovalScreen({ requisitionId }: RequisitionApprovalScreenProps) {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const user = useAuthStore((s) => s.user);
  const list = useRequisitionsForApproval();
  const {
    requisition,
    visibleLinesBySection,
    originalRequestedQtyByLineId,
    setLineEdit,
    saveSection,
    savingSection,
    returnSection,
    nudgeHead,
    nudgingSection,
    approve,
    approving,
    approveError,
    status,
    error,
    reload,
  } = useRequisitionApproval(requisitionId);

  const [editingLine, setEditingLine] = React.useState<{ line: RequisitionApprovalLine; anchor: HTMLElement } | null>(null);
  const [editDraft, setEditDraft] = React.useState<ApprovalEdit>({ approvedQty: '', editReason: '' });
  const [signOpen, setSignOpen] = React.useState(false);
  const anchorRefForPopover = React.useRef<HTMLElement | null>(null);
  anchorRefForPopover.current = editingLine?.anchor ?? null;

  if (!hydrated) return null;

  const isReadOnly = requisition?.status === 'APPROVED';
  const isAlreadyApprovedRace = approveError && requisition?.status === 'APPROVED';

  // Paper `138B-0`'s "Changes from what was requested" summary — derived
  // client-side from `isEdited`/`requestedQty`/`approvedQty`, all of which the
  // detail payload already carries; no new endpoint needed.
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
  const totalChangedLines = requisition?.sections.reduce((sum, s) => sum + s.changedLineCount, 0) ?? 0;

  const openEdit = (line: RequisitionApprovalLine, anchor: HTMLElement) => {
    setEditingLine({ line, anchor });
    setEditDraft({ approvedQty: line.approvedQty ?? line.requestedQty ?? '0', editReason: line.editReason ?? '' });
  };

  const closeEdit = () => setEditingLine(null);

  const saveEdit = async () => {
    if (!editingLine || !requisition) return;
    const sectionTag = requisition.sections.find((s) => s.lines.some((l) => l.id === editingLine.line.id))?.departmentTag;
    if (!sectionTag) return;
    const edit: ApprovalEdit = { approvedQty: editDraft.approvedQty, editReason: editDraft.editReason };
    setLineEdit(editingLine.line.id, edit);
    closeEdit();
    await saveSection(sectionTag, { pendingEdit: { lineId: editingLine.line.id, edit } });
  };

  const handleFillMyself = async (departmentTag: DepartmentTag) => {
    await saveSection(departmentTag, { fillMyself: true });
  };

  const handleReturn = async (departmentTag: DepartmentTag, note: string) => {
    if (note.trim().length === 0) return;
    await returnSection(departmentTag, note.trim());
  };

  const handleApprove = async (pin: string) => {
    const ok = await approve(pin);
    if (ok) setSignOpen(false);
  };

  const handlePrint = (req: RequisitionApprovalDetail) => {
    const draft: PrintableRequisitionProps = {
      orgName: user?.organizationName ?? 'Wendo RMS',
      requisitionType: req.type,
      dateLabel: new Date(req.openedAt).toLocaleString('en-GB'),
      sections: req.sections.map((s) => ({
        departmentTag: s.departmentTag,
        submittedByName: s.submittedByName,
        lines: s.lines.map((l) => ({
          itemName: l.itemName,
          categoryName: l.categoryName,
          requestedQty: l.requestedQty,
          approvedQty: l.approvedQty,
          usageUnit: l.usageUnit,
        })),
      })),
      signedByName: req.approvedByName,
      signedAtLabel: req.approvedAt ? new Date(req.approvedAt).toLocaleString('en-GB') : null,
    };
    try {
      window.sessionStorage.setItem(PRINT_HANDOFF_KEY, JSON.stringify(draft));
    } catch {
      // sessionStorage can throw in a private window — the print route falls back to its own empty-draft message.
    }
    window.open(`/app/branch/requisitions-print/${req.id}`, '_blank');
  };

  const kpis = [
    { label: 'Open requisitions', value: list.rows.length },
    { label: 'Awaiting your approval', value: list.rows.filter((r) => r.sectionsSubmitted > 0 && r.status !== 'APPROVED').length, accent: true },
    { label: 'Depts not yet submitted', value: list.rows.reduce((sum, r) => sum + (r.sectionsTotal - r.sectionsSubmitted), 0) },
    { label: "Today's volume", value: `${list.rows.reduce((sum, r) => sum + Number(r.totalUnits), 0)} units` },
  ];

  if (list.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: user?.organizationName ?? 'Branch', screen: 'Requisitions' }} className="shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-1 px-8 pb-5 pt-7">
            <h1 className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Requisitions</h1>
            <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
              What each department has asked the Central Store for — and what still needs your sign-off.
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <ErrorState
              title="Couldn't load requisitions"
              description="Check your connection and try again. Nothing has been changed."
              onRetry={list.reload}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: user?.organizationName ?? 'Branch', screen: 'Requisitions' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-1 px-8 pb-5 pt-7">
          <h1 className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Requisitions</h1>
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            What each department has asked the Central Store for — and what still needs your sign-off.
          </p>
        </div>

        {list.status === 'loading' ? (
          <RequisitionsKpiSkeletonDesktop />
        ) : (
          <div className="mx-8 mb-5 flex gap-px overflow-hidden rounded-wds-sm border border-wds-border bg-wds-border">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="flex grow basis-0 flex-col gap-1.5 bg-wds-surface px-5 py-4">
                <div className="font-wds-sans text-wds-label font-medium uppercase tracking-wds-label text-wds-text-copy-muted">
                  {kpi.label}
                </div>
                <div className={'font-wds-mono text-wds-kpi font-semibold ' + (kpi.accent ? 'text-wds-primary' : 'text-wds-text-ink')}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 border-t border-t-solid border-t-wds-neutral-800">
          <div className="flex w-[380px] shrink-0 flex-col overflow-visible border-r border-r-solid border-r-black">
            <div className="flex items-center justify-between border-b border-b-solid border-b-wds-border px-5 pb-3 pt-4">
              <div className="font-wds-sans text-wds-label font-medium uppercase tracking-wds-label text-wds-text-copy-muted">Today</div>
              <button
                type="button"
                onClick={() => router.push('/app/branch/requisitions/history')}
                className="font-wds-sans text-wds-caption font-medium text-wds-primary"
              >
                History →
              </button>
            </div>
            {list.status === 'loading' ? (
              <RequisitionsListRailSkeletonDesktop />
            ) : (
              list.rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => router.push(`/app/branch/requisitions?id=${row.id}`)}
                  className={
                    'flex items-center border-b border-b-solid border-b-wds-border px-5 py-3 text-left ' +
                    (row.id === requisitionId ? 'border-l-3 border-l-wds-primary bg-wds-neutral-100' : '')
                  }
                >
                  <div className="flex grow basis-0 flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{requisitionTypeLabel(row.type)}</div>
                      <div className="font-wds-mono text-wds-caption text-wds-text-faint">
                        {row.sectionsSubmitted}/{row.sectionsTotal}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex min-w-0 grow basis-0 flex-col overflow-visible">
            {status === 'loading' ? (
              <RequisitionApprovalSkeletonDesktop />
            ) : status === 'error' ? (
              <div className="flex flex-1 items-center justify-center">
                <ErrorState title="Couldn't load this requisition" description={error ?? 'Try again.'} onRetry={reload} />
              </div>
            ) : !requisition ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-[120px]">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-wds-sm border-[1.5px] border-solid border-wds-border-strong">
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <path
                      d="M9 12h6M9 16h6M9 8h6M5 21h14a2 2 0 0 0 2-2V7l-5-5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2z"
                      fill="none"
                      stroke="var(--wds-text-faint)"
                      strokeWidth="1.75"
                    />
                  </svg>
                </div>
                <div className="font-wds-sans text-wds-section font-medium text-wds-text-ink">Select a requisition</div>
                <div className="max-w-[280px] text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                  Choose one from the list to review its sections, edit lines, and sign.
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between px-8 pt-5">
                  <div className="flex flex-col gap-1">
                    <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">
                      {requisitionTypeLabel(requisition.type)}
                    </div>
                    <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                      {isReadOnly
                        ? `Approved ${requisition.approvedAt ? formatTime(requisition.approvedAt) : ''} · signed by ${requisition.approvedByName ?? 'another manager'} · sent to the Central Store.${
                            totalChangedLines > 0 && requisition.approvedByName === user?.name
                              ? ` Department heads have been notified of the ${totalChangedLines} change${totalChangedLines === 1 ? '' : 's'}.`
                              : ''
                          }`
                        : `Opened ${formatTime(requisition.openedAt)} · review every line, change what you need to (a reason is required), then sign once.`}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => handlePrint(requisition)}>
                    Print
                  </Button>
                </div>

                {isAlreadyApprovedRace ? (
                  <div className="mx-8 mt-4 flex items-center gap-2 rounded-wds-sm border border-wds-info-border bg-wds-info-bg px-3.5 py-2.5">
                    <div className="font-wds-sans text-wds-caption text-wds-info-fg">
                      This requisition was already approved by another signer before you opened it. It&apos;s shown here read-only.
                    </div>
                  </div>
                ) : null}

                <div className="mx-8 mt-4 flex items-center gap-7 rounded-wds-sm bg-wds-neutral-50 px-4 py-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-wds-mono text-wds-section font-semibold text-wds-text-ink">
                      {requisition.sections.filter((s) => s.status === 'SUBMITTED').length}/{requisition.sections.length}
                    </span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">sections in</span>
                  </div>
                  <div className="h-4 w-px shrink-0 bg-wds-border-strong" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-wds-mono text-wds-section font-semibold text-wds-text-ink">
                      {requisition.sections.reduce((sum, s) => sum + s.lines.length, 0)}
                    </span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">total lines</span>
                  </div>
                  <div className="h-4 w-px shrink-0 bg-wds-border-strong" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-wds-mono text-wds-section font-semibold text-wds-primary">
                      {requisition.sections.reduce((sum, s) => sum + s.changedLineCount, 0)}
                    </span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">lines you changed</span>
                  </div>
                  <div className="h-4 w-px shrink-0 bg-wds-border-strong" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-wds-mono text-wds-section font-semibold text-wds-text-ink">
                      {requisition.sections.reduce((sum, s) => sum + Number(s.totalUnits), 0)}
                    </span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">units total</span>
                  </div>
                </div>

                <div className="mx-8 mb-6 mt-4 flex flex-col gap-7 overflow-clip">
                  <div className="flex items-center border-b border-b-solid border-b-wds-border pb-2">
                    <div className="grow basis-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Item
                    </div>
                    <div className="w-[70px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      On hand
                    </div>
                    <div className="w-[60px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Par
                    </div>
                    <div className="w-20 shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Requested
                    </div>
                    <div className="w-24 shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Approved
                    </div>
                  </div>
                  {requisition.sections.map((section) => (
                    <SectionBlock
                      key={section.departmentTag}
                      section={section}
                      lines={visibleLinesBySection[section.departmentTag] ?? section.lines}
                      originalRequestedQtyByLineId={originalRequestedQtyByLineId}
                      onEditLine={openEdit}
                      onFillMyself={handleFillMyself}
                      onNudge={nudgeHead}
                      onReturn={handleReturn}
                      savingSection={savingSection}
                      nudgingSection={nudgingSection}
                      readOnly={Boolean(isReadOnly)}
                    />
                  ))}
                </div>

                {isReadOnly && changeSummaryLines.length > 0 ? (
                  <div className="mx-8 mt-2 flex flex-col gap-2.5 rounded-wds-sm bg-wds-neutral-50 px-5 py-4">
                    <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                      Changes from what was requested
                    </div>
                    {changeSummaryLines.map((entry) => (
                      <div key={entry.departmentTag} className="flex items-baseline gap-2">
                        <div className="shrink-0 font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">
                          {DEPARTMENT_LABEL[entry.departmentTag]} —
                        </div>
                        <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{entry.text}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isReadOnly && requisition.approvedByName ? (
                  <div className="mx-8 mb-8 mt-5 flex items-center justify-between border-t border-t-solid border-t-wds-neutral-800 pt-5">
                    <SignedBySignature
                      name={requisition.approvedByName}
                      roleLine={`${requisition.approvedByName} · Branch Manager · signed ${requisition.approvedAt ? formatTime(requisition.approvedAt) : ''}`}
                    />
                    <div className="flex items-center gap-1.5 rounded-wds-sm border border-wds-success-border bg-wds-success-bg px-3 py-1.5">
                      <div className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
                      <div className="font-wds-sans text-wds-caption font-medium text-wds-success-fg">Sent to Central Store</div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-8 mb-8 flex items-center justify-between rounded-wds-sm bg-wds-neutral-50 px-5 py-4">
                    <div className="max-w-[420px] font-wds-sans text-wds-caption text-wds-text-copy-muted">
                      One signature covers the whole requisition. Affected heads are notified of any changes.
                    </div>
                    <Button onClick={() => setSignOpen(true)}>Approve &amp; sign</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {editingLine && anchorRefForPopover.current ? (
        <EditReasonPopover
          anchorRef={anchorRefForPopover as React.RefObject<HTMLElement>}
          approvedQty={editDraft.approvedQty ?? ''}
          reason={editDraft.editReason ?? ''}
          onApprovedQtyChange={(v) => setEditDraft((prev) => ({ ...prev, approvedQty: v }))}
          onReasonChange={(v) => setEditDraft((prev) => ({ ...prev, editReason: v }))}
          onSave={saveEdit}
          onCancel={closeEdit}
        />
      ) : null}

      <SignSheetDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        title="Sign to approve"
        subtitle={`Enter your PIN to approve and sign ${requisition ? requisitionTypeLabel(requisition.type) : 'this requisition'}.`}
        helperText={`Signing as ${user?.name ?? ''}, Branch Manager`}
        confirmLabel="Confirm"
        onSubmit={handleApprove}
        submitting={approving}
        error={approveError && !isAlreadyApprovedRace ? approveError : undefined}
      />
    </div>
  );
}
