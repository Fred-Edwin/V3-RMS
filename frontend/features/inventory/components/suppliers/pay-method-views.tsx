"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import { Combobox, type ComboboxOption } from "@/components/ui2/combobox";
import type {
  CreatePayMethodBody,
  SupplierPayMethod,
  SupplierPayMethodType,
  UpdatePayMethodBody,
} from "../../types/supplier";
import { useAction } from "../../hooks/use-async";
import {
  createSupplierPayMethod,
  updateSupplierPayMethod,
} from "../../services";
import {
  COMMON_BANKS,
  PAY_METHOD_LABEL,
  PAY_METHOD_ORDER,
} from "../../lib/supplier-labels";
import { groupAccountNumber } from "../../lib/supplier-pay";
import {
  DrawerError,
  DrawerFrame,
  FieldLabel,
  PrimaryFooterButton,
  SecondaryFooterButton,
  fieldClass,
} from "../catalog/drawer-parts";
import { ChoiceChip } from "./supplier-ui";

const bankOptions: ComboboxOption[] = COMMON_BANKS.map((b) => ({
  value: b,
  label: b,
}));

function ReasonPicker({
  reasons,
  value,
  onChange,
  note,
  onNote,
  noteError,
  alwaysNote,
}: {
  reasons: readonly string[];
  value: string;
  onChange: (reason: string) => void;
  note: string;
  onNote: (note: string) => void;
  noteError?: string;
  /** The change drawer always has the optional note; the add drawer asks for words only with “Other”. */
  alwaysNote?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <FieldLabel hint="required">
          {reasons.length === 2 ? "Why add it?" : "Why is it changing?"}
        </FieldLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
          {reasons.map((r) => (
            <ChoiceChip
              key={r}
              selected={value === r}
              onClick={() => onChange(r)}
            >
              {r}
            </ChoiceChip>
          ))}
        </div>
      </div>
      {alwaysNote || value === "Other" ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="reason-note"
            hint={value === "Other" ? "required with Other" : "optional"}
          >
            Note
          </FieldLabel>
          <textarea
            id="reason-note"
            name="reasonNote"
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            aria-invalid={noteError ? true : undefined}
            className={cn(
              fieldClass,
              "h-auto min-h-[56px] resize-none py-2.5 text-[13px] leading-[18px]",
            )}
          />
          {noteError ? (
            <span
              role="alert"
              className="font-wds-sans text-[12px] leading-4 text-wds-error-fg"
            >
              {noteError}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function TellsAccountant() {
  return (
    <div className="flex gap-2.5 border border-wds-info-border bg-wds-info-bg px-3.5 py-3">
      <span
        aria-hidden
        className="mt-1.5 size-1.5 shrink-0 rounded-[3px] bg-wds-info-fg"
      />
      <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-ink">
        The Accountant is told when you save. It is logged in the Audit log
        under Suppliers. No PIN is needed because no money moves.
      </p>
    </div>
  );
}

/** The reason sent to the API: the chip, with the note after it when there is one. */
const joinReason = (reason: string, note: string): string =>
  note.trim()
    ? reason === "Other"
      ? note.trim()
      : `${reason} — ${note.trim()}`
    : reason;

// ─── Add a payment method (Paper step 19, second artboard) ──────────────────

const ADD_REASONS = ["Supplier asked for it", "Other"] as const;

export interface AddPayMethodViewProps {
  supplierId: string;
  supplierName: string;
  onCancel: () => void;
  onAdded: () => void;
}

/**
 * Add a payment method. The kind is chosen first and the fields change with it; a cheque asks who it is payable to
 * (the supplier's name to start), the bank and an optional note. A reason is required, kept in the audit log and
 * sent to the Accountant.
 */
export function AddPayMethodView({
  supplierId,
  supplierName,
  onCancel,
  onAdded,
}: AddPayMethodViewProps) {
  const [kind, setKind] =
    React.useState<SupplierPayMethodType>("BANK_TRANSFER");
  const [v, setV] = React.useState({
    bankName: "",
    bankBranch: "",
    accountName: supplierName,
    accountNumber: "",
    paybillNumber: "",
    accountReference: "",
    tillNumber: "",
    phone: "",
    registeredName: supplierName,
    note: "",
  });
  const [reason, setReason] = React.useState("");
  const [reasonNote, setReasonNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const create = useAction(
    createSupplierPayMethod,
    "Could not add the payment method.",
  );
  const set = (key: keyof typeof v) => (value: string) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    create.clear();
  };

  const submit = async () => {
    const need = (key: keyof typeof v, label: string): string | null =>
      v[key].trim() ? null : `Enter ${label}.`;
    const found: Record<string, string | null> = {};
    switch (kind) {
      case "BANK_TRANSFER":
        found.bankName = need("bankName", "the bank");
        found.accountName = need("accountName", "the account name");
        found.accountNumber = need("accountNumber", "the account number");
        break;
      case "MPESA_PAYBILL":
        found.paybillNumber = need("paybillNumber", "the Paybill number");
        break;
      case "MPESA_TILL":
        found.tillNumber = need("tillNumber", "the Till number");
        break;
      case "MPESA_SEND_MONEY":
        found.phone = need("phone", "the phone number");
        found.registeredName = need("registeredName", "the registered name");
        break;
      case "CHEQUE":
        found.registeredName = need("registeredName", "who it is payable to");
        found.bankName = need("bankName", "the bank");
        break;
      case "CASH":
        break;
    }
    if (!reason) found.reason = "Choose why you are adding it.";
    else if (reason === "Other" && !reasonNote.trim())
      found.reasonNote = "Say what happened.";
    const messages = Object.fromEntries(
      Object.entries(found).filter(
        (entry): entry is [string, string] => entry[1] !== null,
      ),
    );
    setErrors(messages);
    if (Object.keys(messages).length > 0) return;

    const why = joinReason(reason, reasonNote);
    const body: CreatePayMethodBody =
      kind === "BANK_TRANSFER"
        ? {
            type: kind,
            reason: why,
            bankName: v.bankName.trim(),
            accountName: v.accountName.trim(),
            accountNumber: v.accountNumber.replace(/\s+/g, ""),
            ...(v.bankBranch.trim() ? { bankBranch: v.bankBranch.trim() } : {}),
          }
        : kind === "MPESA_PAYBILL"
          ? {
              type: kind,
              reason: why,
              paybillNumber: v.paybillNumber.trim(),
              ...(v.accountReference.trim()
                ? { accountReference: v.accountReference.trim() }
                : {}),
            }
          : kind === "MPESA_TILL"
            ? { type: kind, reason: why, tillNumber: v.tillNumber.trim() }
            : kind === "MPESA_SEND_MONEY"
              ? {
                  type: kind,
                  reason: why,
                  phone: v.phone.trim(),
                  registeredName: v.registeredName.trim(),
                }
              : kind === "CHEQUE"
                ? {
                    type: kind,
                    reason: why,
                    registeredName: v.registeredName.trim(),
                    bankName: v.bankName.trim(),
                    ...(v.note.trim() ? { note: v.note.trim() } : {}),
                  }
                : { type: "CASH", reason: why };
    const saved = await create.run(supplierId, body);
    if (saved) onAdded();
  };

  const text = (
    key: keyof typeof v,
    label: string,
    opts: {
      mono?: boolean;
      hint?: string;
      help?: string;
      autoFocus?: boolean;
      placeholder?: string;
    } = {},
  ) => (
    <div className="flex flex-col gap-1.5" key={key}>
      <FieldLabel htmlFor={`pm-${key}`} hint={opts.hint}>
        {label}
      </FieldLabel>
      <input
        id={`pm-${key}`}
        name={key}
        autoFocus={opts.autoFocus}
        autoComplete="off"
        value={v[key]}
        placeholder={opts.placeholder}
        onChange={(e) => set(key)(e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        className={cn(fieldClass, "h-10", opts.mono && "font-wds-mono")}
      />
      {errors[key] ? (
        <span
          role="alert"
          className="font-wds-sans text-[12px] leading-4 text-wds-error-fg"
        >
          {errors[key]}
        </span>
      ) : opts.help ? (
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {opts.help}
        </span>
      ) : null}
    </div>
  );
  const bank = (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Bank</FieldLabel>
      <Combobox
        chevron
        value={v.bankName}
        onValueChange={set("bankName")}
        options={bankOptions}
        onCreate={set("bankName")}
        createLabel={(q) => `Use “${q}”`}
        placeholder="Choose a bank"
        aria-label="Bank"
        name="bankName"
        className="h-10 text-[14px]"
      />
      {errors.bankName ? (
        <span
          role="alert"
          className="font-wds-sans text-[12px] leading-4 text-wds-error-fg"
        >
          {errors.bankName}
        </span>
      ) : null}
    </div>
  );

  return (
    <DrawerFrame
      eyebrow={`${supplierName} · new payment method`}
      title="Add a payment method"
      subtitle="Money goes to these details, so a new method needs a reason and is shown to the Accountant."
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onCancel}>
            Cancel
          </SecondaryFooterButton>
          <PrimaryFooterButton onClick={submit} disabled={create.saving}>
            Add method
          </PrimaryFooterButton>
        </div>
      }
    >
      {create.failure ? (
        <DrawerError>{create.failure.message}</DrawerError>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <FieldLabel>What kind?</FieldLabel>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Kind of payment method"
        >
          {PAY_METHOD_ORDER.map((t) => (
            <ChoiceChip
              key={t}
              selected={kind === t}
              onClick={() => {
                setKind(t);
                setErrors({});
                create.clear();
              }}
            >
              {PAY_METHOD_LABEL[t]}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {kind === "CHEQUE" ? (
        <>
          {text("registeredName", "Payable to", {
            autoFocus: true,
            help: "Exactly as it should be written on the cheque.",
          })}
          {bank}
          {text("note", "Note", {
            hint: "optional",
            placeholder: "For example: used for invoices over KES 100,000",
          })}
        </>
      ) : null}
      {kind === "BANK_TRANSFER" ? (
        <>
          {bank}
          {text("bankBranch", "Branch", { hint: "optional" })}
          {text("accountName", "Account name")}
          {text("accountNumber", "Account number", { mono: true })}
        </>
      ) : null}
      {kind === "MPESA_PAYBILL" ? (
        <>
          {text("paybillNumber", "Paybill number", {
            mono: true,
            autoFocus: true,
          })}
          {text("accountReference", "Account reference", {
            hint: "optional",
            mono: true,
          })}
        </>
      ) : null}
      {kind === "MPESA_TILL"
        ? text("tillNumber", "Till number", { mono: true, autoFocus: true })
        : null}
      {kind === "MPESA_SEND_MONEY" ? (
        <>
          {text("phone", "Phone number", {
            mono: true,
            autoFocus: true,
            placeholder: "+254 722 000 000",
          })}
          {text("registeredName", "Registered name", {
            help: "The name M-Pesa shows when you send money to this number.",
          })}
        </>
      ) : null}

      <ReasonPicker
        reasons={ADD_REASONS}
        value={reason}
        onChange={(r) => {
          setReason(r);
          setErrors((p) => ({ ...p, reason: "" }));
          create.clear();
        }}
        note={reasonNote}
        onNote={setReasonNote}
        noteError={errors.reasonNote}
      />
      {errors.reason ? (
        <span
          role="alert"
          className="-mt-3 font-wds-sans text-[12px] leading-4 text-wds-error-fg"
        >
          {errors.reason}
        </span>
      ) : null}
      <TellsAccountant />
    </DrawerFrame>
  );
}

// ─── Change payment details (Paper step 19, first artboard) ─────────────────

interface FieldSpec {
  key: keyof Pick<
    SupplierPayMethod,
    | "bankName"
    | "bankBranch"
    | "accountName"
    | "phone"
    | "paybillNumber"
    | "accountReference"
    | "tillNumber"
    | "registeredName"
    | "note"
  >;
  label: string;
  mono?: boolean;
  optional?: boolean;
}
const CHANGE_FIELDS: Record<
  Exclude<SupplierPayMethodType, "CASH">,
  { title: string; fields: FieldSpec[]; reasons: readonly string[] }
> = {
  BANK_TRANSFER: {
    title: "Change the bank account",
    fields: [
      { key: "bankName", label: "Bank" },
      { key: "bankBranch", label: "Branch", optional: true },
      { key: "accountName", label: "Account name" },
    ],
    reasons: ["Supplier changed bank", "Entered wrong", "Other"],
  },
  MPESA_PAYBILL: {
    title: "Change the Paybill",
    fields: [
      { key: "paybillNumber", label: "Paybill number", mono: true },
      {
        key: "accountReference",
        label: "Account reference",
        mono: true,
        optional: true,
      },
    ],
    reasons: ["Supplier changed it", "Entered wrong", "Other"],
  },
  MPESA_TILL: {
    title: "Change the Till",
    fields: [{ key: "tillNumber", label: "Till number", mono: true }],
    reasons: ["Supplier changed it", "Entered wrong", "Other"],
  },
  MPESA_SEND_MONEY: {
    title: "Change the M-Pesa number",
    fields: [
      { key: "phone", label: "Phone number", mono: true },
      { key: "registeredName", label: "Registered name" },
    ],
    reasons: ["Supplier changed it", "Entered wrong", "Other"],
  },
  CHEQUE: {
    title: "Change the cheque details",
    fields: [
      { key: "registeredName", label: "Payable to" },
      { key: "bankName", label: "Bank" },
      { key: "note", label: "Note", optional: true },
    ],
    reasons: ["Supplier changed it", "Entered wrong", "Other"],
  },
};

/** •••• •••• 7702 from whatever was typed: the last four digits only. */
const maskedTail = (raw: string): string =>
  `•••• •••• ${raw.replace(/\s+/g, "").slice(-4)}`;

export interface ChangePayMethodViewProps {
  supplierId: string;
  supplierName: string;
  method: SupplierPayMethod;
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Change payment details. A NOW / AFTER table shows exactly what changes (the account number is only ever shown masked),
 * then the new values, a required reason and an optional note. Only fields that differ are sent.
 */
export function ChangePayMethodView({
  supplierId,
  supplierName,
  method,
  onCancel,
  onSaved,
}: ChangePayMethodViewProps) {
  const spec = method.type === "CASH" ? null : CHANGE_FIELDS[method.type];
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      (spec?.fields ?? []).map((f) => [f.key, method[f.key] ?? ""]),
    ),
  );
  const [newAccount, setNewAccount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reasonNote, setReasonNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const update = useAction(
    updateSupplierPayMethod,
    "Could not save the change.",
  );
  if (!spec) return null;

  const isBank = method.type === "BANK_TRANSFER";
  const changedFields = spec.fields.filter(
    (f) => (values[f.key] ?? "").trim() !== (method[f.key] ?? ""),
  );
  const accountChanged = isBank && newAccount.replace(/\s+/g, "") !== "";
  const anyChange = changedFields.length > 0 || accountChanged;

  const submit = async () => {
    const found: Record<string, string> = {};
    for (const f of spec.fields)
      if (!f.optional && !(values[f.key] ?? "").trim())
        found[f.key] = `Enter ${f.label.toLowerCase()}.`;
    if (!anyChange) found.form = "Change at least one detail first.";
    if (!reason) found.reason = "Choose why it is changing.";
    else if (reason === "Other" && !reasonNote.trim())
      found.reasonNote = "Say what happened.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body: UpdatePayMethodBody = {
      reason: joinReason(reason, reasonNote),
    };
    for (const f of changedFields)
      body[f.key] = (values[f.key] ?? "").trim() || null;
    if (accountChanged) body.accountNumber = newAccount.replace(/\s+/g, "");
    const saved = await update.run(supplierId, method.id, body);
    if (saved) onSaved();
  };

  const rows: Array<{
    label: string;
    now: string;
    after: string | null;
    mono?: boolean;
  }> = [];
  if (isBank)
    rows.push({
      label: "Account number",
      now: method.accountNumberMasked
        ? `•••• •••• ${method.accountNumberMasked.replace(/^•+/, "")}`
        : "—",
      after: accountChanged ? maskedTail(newAccount) : null,
      mono: true,
    });
  for (const f of spec.fields) {
    const next = (values[f.key] ?? "").trim();
    rows.push({
      label: f.label,
      now: method[f.key] || "—",
      after: next !== (method[f.key] ?? "") ? next || "—" : null,
      mono: f.mono,
    });
  }

  return (
    <DrawerFrame
      eyebrow={`${supplierName} · ${PAY_METHOD_LABEL[method.type]}`}
      title={spec.title}
      subtitle="Money goes to these details, so a change needs a reason and is shown to the Accountant."
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onCancel}>
            Cancel
          </SecondaryFooterButton>
          <PrimaryFooterButton onClick={submit} disabled={update.saving}>
            Save change
          </PrimaryFooterButton>
        </div>
      }
      bodyGap="page"
    >
      {update.failure ? (
        <DrawerError>{update.failure.message}</DrawerError>
      ) : null}
      {errors.form ? <DrawerError>{errors.form}</DrawerError> : null}
      <div role="table" aria-label="What changes" className="flex flex-col">
        <div
          role="row"
          className="flex h-8 shrink-0 items-center border-b border-wds-text-ink"
        >
          <span
            role="columnheader"
            className="w-[130px] shrink-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink"
          >
            WHAT
          </span>
          <span
            role="columnheader"
            className="min-w-0 grow basis-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink"
          >
            NOW
          </span>
          <span
            role="columnheader"
            className="min-w-0 grow basis-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink"
          >
            AFTER
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            role="row"
            className="flex min-h-[42px] shrink-0 items-center border-b border-wds-neutral-100 py-1"
          >
            <span
              role="cell"
              className="w-[130px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary"
            >
              {row.label}
            </span>
            <span
              role="cell"
              className={cn(
                "min-w-0 grow basis-0 break-words text-[13px] leading-4 text-wds-text-secondary",
                row.mono ? "font-wds-mono" : "font-wds-sans",
              )}
            >
              {row.now}
            </span>
            <span
              role="cell"
              className={cn(
                "min-w-0 grow basis-0 break-words text-[13px] leading-4",
                row.after === null
                  ? "font-wds-sans text-wds-text-secondary"
                  : cn(
                      "font-semibold text-wds-text-ink",
                      row.mono ? "font-wds-mono" : "font-wds-sans",
                    ),
              )}
            >
              {row.after === null ? "No change" : row.after}
            </span>
          </div>
        ))}
      </div>

      {isBank ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="pm-new-account">New account number</FieldLabel>
          <input
            id="pm-new-account"
            name="accountNumber"
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            value={newAccount}
            onChange={(e) => {
              setNewAccount(e.target.value);
              update.clear();
            }}
            placeholder={groupAccountNumber("000000000000")}
            className={cn(
              fieldClass,
              "h-10 border-[1.5px] border-wds-selected-edge font-wds-mono",
            )}
          />
        </div>
      ) : null}
      {spec.fields.map((f, i) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor={`pm-${f.key}`}
            hint={f.optional ? "optional" : undefined}
          >
            {f.label}
          </FieldLabel>
          <input
            id={`pm-${f.key}`}
            name={f.key}
            autoFocus={!isBank && i === 0}
            autoComplete="off"
            value={values[f.key] ?? ""}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, [f.key]: e.target.value }));
              setErrors((p) => ({ ...p, [f.key]: "" }));
              update.clear();
            }}
            aria-invalid={errors[f.key] ? true : undefined}
            className={cn(fieldClass, "h-10", f.mono && "font-wds-mono")}
          />
          {errors[f.key] ? (
            <span
              role="alert"
              className="font-wds-sans text-[12px] leading-4 text-wds-error-fg"
            >
              {errors[f.key]}
            </span>
          ) : null}
        </div>
      ))}

      <ReasonPicker
        alwaysNote
        reasons={spec.reasons}
        value={reason}
        onChange={(r) => {
          setReason(r);
          setErrors((p) => ({ ...p, reason: "" }));
          update.clear();
        }}
        note={reasonNote}
        onNote={setReasonNote}
        noteError={errors.reasonNote}
      />
      {errors.reason ? (
        <span
          role="alert"
          className="-mt-4 font-wds-sans text-[12px] leading-4 text-wds-error-fg"
        >
          {errors.reason}
        </span>
      ) : null}
      <TellsAccountant />
    </DrawerFrame>
  );
}
