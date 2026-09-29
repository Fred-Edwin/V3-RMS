"use client";

import * as React from "react";
import { OTPInput, type SlotProps } from "input-otp";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui2/button";
import { Input } from "@/components/ui2/input";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { ApiError } from "@/types/api";

/**
 * Set / change the caller's own 4-digit signing PIN. One form, three homes:
 * the Sign Sheet's "Set your PIN" step (before a first signature), the
 * Profile "Signing PIN" card, and the Store Manager Settings › My PIN tab.
 * Paper page "Pre-Demo · Team & PIN" (artboards 4, 5a, 5b, 6).
 *
 * Changing an EXISTING PIN needs the current account password
 * (`requireCurrentPassword`); a first-time set needs nothing. The PIN only
 * ever lives in this component's state and the one request that saves it.
 */
const PIN_LENGTH = 4;

export interface SetPinFormProps {
  /** True when a PIN already exists — the server then demands the current password. */
  requireCurrentPassword?: boolean;
  submitLabel: string;
  /** Renders a Cancel button when given. */
  onCancel?: () => void;
  /** Runs after the server has saved the PIN; receives the new PIN (the Sign Sheet signs with it straight away). */
  onDone: (pin: string) => void | Promise<void>;
  /** `stacked`: boxes fill the row (mobile sheet). `inline`: New / Confirm side by side (desktop). */
  layout?: "inline" | "stacked";
  className?: string;
}

interface FormError {
  field: "password" | "confirm" | "other";
  message: string;
}

function MaskedBox({
  slot,
  stacked,
  invalid,
}: {
  slot: SlotProps;
  stacked: boolean;
  invalid: boolean;
}) {
  const filled = slot.char != null && slot.char !== "";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-wds-sm border bg-wds-surface transition-colors duration-150",
        stacked ? "h-[52px] min-w-0 flex-1" : "h-12 w-11 shrink-0",
        invalid
          ? "border-wds-error-fg"
          : slot.isActive
            ? "border-wds-primary shadow-wds-ring"
            : "border-wds-border-strong",
      )}
    >
      {filled ? (
        <span className="size-2.5 rounded-full bg-wds-text-ink" aria-hidden />
      ) : null}
      {slot.hasFakeCaret ? (
        <span
          className="h-5 w-0.5 animate-caret-blink bg-wds-primary"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

interface PinFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onComplete?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  disabled: boolean;
  invalid: boolean;
  stacked: boolean;
  autoFocus?: boolean;
}

function PinField({
  label,
  value,
  onChange,
  onComplete,
  inputRef,
  disabled,
  invalid,
  stacked,
  autoFocus,
}: PinFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", stacked && "w-full")}>
      <span className="font-wds-sans text-wds-caption font-medium text-wds-text-ink">
        {label}
      </span>
      <OTPInput
        ref={inputRef}
        maxLength={PIN_LENGTH}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid || undefined}
        containerClassName={cn(
          "flex gap-2 has-[:disabled]:opacity-60",
          stacked && "w-full gap-2.5",
        )}
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              <MaskedBox
                key={i}
                slot={slot}
                stacked={stacked}
                invalid={invalid}
              />
            ))}
          </>
        )}
      />
    </div>
  );
}

export function SetPinForm({
  requireCurrentPassword = false,
  submitLabel,
  onCancel,
  onDone,
  layout = "inline",
  className,
}: SetPinFormProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const stacked = layout === "stacked";
  const [password, setPassword] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<FormError | null>(null);
  const confirmRef = React.useRef<HTMLInputElement>(null);

  const ready =
    pin.length === PIN_LENGTH &&
    confirm.length === PIN_LENGTH &&
    (!requireCurrentPassword || password.length > 0);

  const submit = async () => {
    if (!ready || submitting || !accessToken) return;
    if (pin !== confirm) {
      setConfirm("");
      setError({
        field: "confirm",
        message: "The two PINs don't match. Try again.",
      });
      confirmRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authService.setPin(
        {
          pin,
          ...(requireCurrentPassword ? { currentPassword: password } : {}),
        },
        accessToken,
      );
    } catch (err) {
      setSubmitting(false);
      if (
        err instanceof ApiError &&
        err.statusCode === 400 &&
        requireCurrentPassword
      ) {
        setError({ field: "password", message: "That password isn't right." });
        setPassword("");
      } else {
        setError({
          field: "other",
          message:
            "Couldn't save your PIN. Check your connection and try again.",
        });
      }
      return;
    }
    try {
      await onDone(pin);
    } finally {
      setSubmitting(false);
      setPin("");
      setConfirm("");
      setPassword("");
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {requireCurrentPassword ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="set-pin-current-password"
            className="font-wds-sans text-wds-caption font-medium text-wds-text-ink"
          >
            Current password
          </label>
          <Input
            id="set-pin-current-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={submitting}
            aria-invalid={error?.field === "password" || undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error?.field === "password") setError(null);
            }}
            className="h-9"
          />
          {error?.field === "password" ? (
            <p
              role="alert"
              className="font-wds-sans text-wds-caption text-wds-error-fg"
            >
              {error.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn("flex gap-6", stacked ? "flex-col gap-4" : "flex-wrap")}
      >
        <PinField
          label="New PIN"
          value={pin}
          onChange={(next) => {
            setPin(next);
            if (error?.field === "confirm") setError(null);
          }}
          onComplete={() => confirmRef.current?.focus()}
          disabled={submitting}
          invalid={false}
          stacked={stacked}
          autoFocus={!requireCurrentPassword}
        />
        <div className={cn("flex flex-col gap-1.5", stacked && "w-full")}>
          <PinField
            label="Confirm PIN"
            value={confirm}
            onChange={(next) => {
              setConfirm(next);
              if (error?.field === "confirm") setError(null);
            }}
            inputRef={confirmRef}
            disabled={submitting}
            invalid={error?.field === "confirm"}
            stacked={stacked}
          />
          {error?.field === "confirm" ? (
            <p
              role="alert"
              className="font-wds-sans text-wds-caption text-wds-error-fg"
            >
              {error.message}
            </p>
          ) : null}
        </div>
      </div>

      {error?.field === "other" ? (
        <p
          role="alert"
          className="font-wds-sans text-wds-caption text-wds-error-fg"
        >
          {error.message}
        </p>
      ) : null}

      <div className={cn("flex gap-2", stacked ? "gap-2.5" : "justify-end")}>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            className={cn(stacked && "h-11 grow basis-0")}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          className={cn(stacked && "h-11 grow-[2] basis-0")}
          disabled={!ready || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
