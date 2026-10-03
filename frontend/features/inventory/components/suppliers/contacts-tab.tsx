import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import type { SupplierContact } from '../../types/supplier';
import { SUPPLIER_CONTACT_ROLE_LABEL } from '../../lib/supplier-labels';
import { StockEmptyCard } from '../stock/stock-states';
import { QuietAction, RowAction, TabHeading, tableHead } from './supplier-ui';

export interface ContactsTabProps {
  supplierName: string;
  contacts: SupplierContact[];
  canEdit: boolean;
  makingPrimaryId: string | null;
  onAdd: () => void;
  onEdit: (contact: SupplierContact) => void;
  onMakePrimary: (contact: SupplierContact) => void;
}

/** Contacts tab (Paper step 22): one primary contact, whom orders and statements go to first. */
export function ContactsTab({ supplierName, contacts, canEdit, makingPrimaryId, onAdd, onEdit, onMakePrimary }: ContactsTabProps) {
  const first = supplierName.split(/\s+/)[0] ?? supplierName;
  return (
    <div className="flex flex-col gap-5">
      <TabHeading title={`People at ${first}`} actions={canEdit ? <Button className="h-[34px] px-4" onClick={onAdd}>Add contact</Button> : null}>
        One primary contact. Orders and statements go to them first.
      </TabHeading>
      {contacts.length === 0 ? (
        <div className="flex justify-center border border-wds-border bg-white px-4 py-8">
          <StockEmptyCard
            title="No contacts yet"
            description="Add the person to call about orders and payments."
            actionLabel={canEdit ? 'Add contact' : undefined}
            onAction={canEdit ? onAdd : undefined}
          />
        </div>
      ) : (
        <div role="table" aria-label="Contacts" className="border border-wds-border bg-white">
          <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
            <span role="columnheader" className={cn(tableHead, 'w-[220px] shrink-0')}>NAME</span>
            <span role="columnheader" className={cn(tableHead, 'w-[130px] shrink-0')}>ROLE</span>
            <span role="columnheader" className={cn(tableHead, 'w-[170px] shrink-0')}>PHONE</span>
            <span role="columnheader" className={cn(tableHead, 'min-w-0 grow basis-0')}>EMAIL</span>
            <span role="columnheader" className={cn(tableHead, 'w-[110px] shrink-0')}>PRIMARY</span>
            <span role="columnheader" className="w-[110px] shrink-0" />
          </div>
          {contacts.map((contact) => (
            <div key={contact.id} role="row" className="flex h-[54px] items-center border-b border-wds-neutral-100 px-4 last:border-b-0">
              <span role="cell" className="w-[220px] shrink-0 truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{contact.name}</span>
              <span role="cell" className="w-[130px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{SUPPLIER_CONTACT_ROLE_LABEL[contact.role]}</span>
              <span role="cell" className="w-[170px] shrink-0 font-wds-mono text-[13px] leading-4 text-wds-text-ink">{contact.phone ?? <span className="text-wds-text-faint">—</span>}</span>
              <span role="cell" className="min-w-0 grow basis-0 truncate font-wds-sans text-[13px] leading-4 text-wds-text-ink">{contact.email ?? <span className="text-wds-text-faint">—</span>}</span>
              <span role="cell" className="w-[110px] shrink-0">
                {contact.isPrimary ? (
                  <span className="flex items-center gap-[7px]">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-[3px] bg-wds-success-fg" />
                    <span className="font-wds-sans text-[13px] leading-4 text-wds-success-fg">Primary</span>
                  </span>
                ) : canEdit ? (
                  <QuietAction className="text-wds-text-faint" disabled={makingPrimaryId === contact.id} onClick={() => onMakePrimary(contact)}>
                    Make primary
                  </QuietAction>
                ) : null}
              </span>
              <span role="cell" className="flex w-[110px] shrink-0 justify-end">
                {canEdit ? <RowAction onClick={() => onEdit(contact)}>Edit</RowAction> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
