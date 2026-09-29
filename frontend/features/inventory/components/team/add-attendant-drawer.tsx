'use client';

import * as React from 'react';

import { Input } from '@/components/ui2/input';
import { Label } from '@/components/ui2/label';
import { ApiError, formatApiErrorMessage } from '@/types/api';
import { DrawerShell } from '../drawer-shell';
import { FormErrorBanner } from '../stock/stock-states';
import { addAttendant } from '../../services/team-api-service';
import type { TeamMember } from '../../types/team';

/**
 * Add attendant — Paper "Pre-Demo · Team & PIN" artboard 2. Name, email and a
 * temporary password (same mechanism as the admin/staff flow: `POST /staff`
 * takes `temporaryPassword`, min 8). The role is fixed to Store Attendant — no
 * picker; the server forces the Central Store org.
 */
export interface AddAttendantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (member: TeamMember) => void;
  /** Phone: render as a bottom sheet. */
  mobile?: boolean;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddAttendantDrawer({ open, onOpenChange, onAdded, mobile = false }: AddAttendantDrawerProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [bannerError, setBannerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPassword('');
      setErrors({});
      setBannerError(null);
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Enter their full name.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address, e.g. mary@wendo.co.ke';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setBannerError(null);
    try {
      const member = await addAttendant({ name: name.trim(), email: email.trim(), temporaryPassword: password });
      onAdded(member);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setErrors({ email: 'That email is already in use.' });
      } else {
        setBannerError(formatApiErrorMessage(err, "Couldn't create the account."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}
      title="Add attendant"
      description="Creates a Store Attendant account at the Central Store. They set their own signing PIN the first time they sign."
      primaryLabel={submitting ? 'Creating…' : 'Create account'}
      onPrimaryAction={() => void submit()}
      primaryDisabled={submitting}
      side={mobile ? 'bottom' : 'right'}
    >
      {bannerError ? <FormErrorBanner title={bannerError} description="Nothing was created. Your entries are kept — try again." /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendant-name">Full name</Label>
        <Input
          id="attendant-name"
          value={name}
          autoFocus
          autoComplete="off"
          disabled={submitting}
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
          className={mobile ? 'h-11' : 'h-9'}
        />
        {errors.name ? <FieldError>{errors.name}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendant-email">Email</Label>
        <Input
          id="attendant-email"
          type="email"
          value={email}
          autoComplete="off"
          disabled={submitting}
          aria-invalid={errors.email ? true : undefined}
          onChange={(e) => setEmail(e.target.value)}
          className={mobile ? 'h-11' : 'h-9'}
        />
        {errors.email ? <FieldError>{errors.email}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendant-password">Temporary password</Label>
        <Input
          id="attendant-password"
          type="password"
          value={password}
          autoComplete="new-password"
          disabled={submitting}
          aria-invalid={errors.password ? true : undefined}
          onChange={(e) => setPassword(e.target.value)}
          className={mobile ? 'h-11 font-wds-mono' : 'h-9 font-wds-mono'}
        />
        {errors.password ? (
          <FieldError>{errors.password}</FieldError>
        ) : (
          <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            At least 8 characters. Share it with them in person.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Role</Label>
        <div className="flex h-9 items-center rounded-wds-sm border border-wds-border bg-wds-neutral-50 px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
          Store Attendant · fixed
        </div>
      </div>
    </DrawerShell>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
      {children}
    </p>
  );
}
