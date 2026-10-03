'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { SupplierContact, SupplierContactRole } from '../../types/supplier';
import { useAction } from '../../hooks/use-async';
import { createSupplierContact, deleteSupplierContact, updateSupplierContact } from '../../services';
import { SUPPLIER_CONTACT_ROLE_LABEL, SUPPLIER_CONTACT_ROLE_ORDER } from '../../lib/supplier-labels';
import { DangerLink, DrawerError, DrawerFrame, FieldLabel, PrimaryFooterButton, SecondaryFooterButton, fieldClass } from '../catalog/drawer-parts';
import { ChoiceChip } from './supplier-ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactViewProps {
  supplierId: string;
  supplierName: string;
  /** Present = edit this contact; absent = a new one. */
  contact?: SupplierContact;
  /** Another contact is primary already, so this one cannot simply be removed while it is the primary. */
  onCancel: () => void;
  onSaved: () => void;
}

/** Add or edit a contact. A second contact can be made the primary one here; the old primary steps down. */
export function ContactView({ supplierId, supplierName, contact, onCancel, onSaved }: ContactViewProps) {
  const editing = contact !== undefined;
  const [name, setName] = React.useState(contact?.name ?? '');
  const [role, setRole] = React.useState<SupplierContactRole>(contact?.role ?? 'SALES_REP');
  const [phone, setPhone] = React.useState(contact?.phone ?? '');
  const [email, setEmail] = React.useState(contact?.email ?? '');
  const [primary, setPrimary] = React.useState(contact?.isPrimary ?? false);
  const [errors, setErrors] = React.useState<{ name?: string; email?: string }>({});
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const create = useAction(createSupplierContact, 'Could not add the contact.');
  const update = useAction(updateSupplierContact, 'Could not save the contact.');
  const remove = useAction(deleteSupplierContact, 'Could not remove the contact.');
  const failure = create.failure ?? update.failure ?? remove.failure;
  const saving = create.saving || update.saving || remove.saving;
  const clear = () => {
    create.clear();
    update.clear();
    remove.clear();
  };

  const submit = async () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'Enter their name.';
    if (email.trim() && !EMAIL.test(email.trim())) found.email = 'Enter an email like orders@samrat.co.ke.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { name: name.trim(), role, phone: phone.trim() || null, email: email.trim() || null };
    const saved = editing ? await update.run(supplierId, contact.id, { ...body, ...(primary && !contact.isPrimary ? { isPrimary: true } : {}) }) : await create.run(supplierId, { ...body, isPrimary: primary });
    if (saved) onSaved();
  };

  const doDelete = async () => {
    if (!contact) return;
    const done = await remove.run(supplierId, contact.id);
    if (done !== null) onSaved();
  };

  return (
    <DrawerFrame
      eyebrow={supplierName}
      title={editing ? 'Edit contact' : 'Add contact'}
      subtitle="Orders and statements go to the primary contact first."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {editing && !contact.isPrimary ? (
            confirmDelete ? (
              <DangerLink onClick={() => void doDelete()} disabled={saving}>
                Yes, remove them
              </DangerLink>
            ) : (
              <DangerLink onClick={() => setConfirmDelete(true)}>Remove contact</DangerLink>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2.5">
            <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
            <PrimaryFooterButton onClick={submit} disabled={saving}>
              {editing ? 'Save contact' : 'Add contact'}
            </PrimaryFooterButton>
          </div>
        </div>
      }
    >
      {failure ? <DrawerError>{failure.message}</DrawerError> : null}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="contact-name">Name</FieldLabel>
        <input
          id="contact-name"
          name="name"
          autoFocus
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((p) => ({ ...p, name: undefined }));
            clear();
          }}
          aria-invalid={errors.name ? true : undefined}
          className={cn(fieldClass, 'h-10')}
        />
        {errors.name ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{errors.name}</span> : null}
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>Role</FieldLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Role">
          {SUPPLIER_CONTACT_ROLE_ORDER.map((r) => (
            <ChoiceChip key={r} selected={role === r} onClick={() => setRole(r)}>
              {SUPPLIER_CONTACT_ROLE_LABEL[r]}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="contact-phone" hint="optional">
          Phone
        </FieldLabel>
        <input id="contact-phone" name="phone" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 722 000 000" className={cn(fieldClass, 'h-10 font-wds-mono')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="contact-email" hint="optional">
          Email
        </FieldLabel>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((p) => ({ ...p, email: undefined }));
          }}
          aria-invalid={errors.email ? true : undefined}
          className={cn(fieldClass, 'h-10')}
        />
        {errors.email ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{errors.email}</span> : null}
      </div>
      {contact?.isPrimary ? (
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">This is the primary contact. To change who it is, press “Make primary” on another contact.</p>
      ) : (
        <label className="flex cursor-pointer items-center gap-2.5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="size-4 shrink-0 accent-[var(--wds-selected-edge)]" />
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">Make them the primary contact</span>
        </label>
      )}
    </DrawerFrame>
  );
}
