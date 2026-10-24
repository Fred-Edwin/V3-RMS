'use client';

import * as React from 'react';

import { DialogButton, DraftIndicator, FileSoFarPanel, ListDetailLayout, ListRow, PersonAvatar, StepRail, WizardFooter, WizardLayout, WizardTopBar } from '../..';
import { Label, Section } from '../gallery-parts';

/** Gallery section 8: the list and detail layout and the stepper wizard. */
export function LayoutSections() {
  const people = [
    { name: 'Brian Otieno', role: 'Waiter', presence: 'on' as const },
    { name: 'Joy Chebet', role: 'Barista', presence: 'late' as const },
    { name: 'Amina Hassan', role: 'Barista', presence: 'off' as const },
    { name: 'Peter Karanja', role: 'Kitchen hand' },
  ];
  const [sel, setSel] = React.useState('Joy Chebet');
  const [phoneDetail, setPhoneDetail] = React.useState(false);

  return (
    <Section id="layouts" title="8 · List and detail, stepper wizard" node="R3E-0 / R5O-0" note="The chosen row has a caramel bar. On a phone the list and detail become one column (toggle below). The wizard shows steps left, form centre, “The file so far” right, and the footer with the one brown button.">
      <div>
        <Label>List and detail (desktop width)</Label>
        <ListDetailLayout
          className="min-h-[220px]"
          showDetail={phoneDetail}
          list={
            <div>
              {people.map((p) => (
                <ListRow key={p.name} selected={sel === p.name} onSelect={() => { setSel(p.name); setPhoneDetail(true); }}>
                  <PersonAvatar name={p.name} size="sm" presence={p.presence} />
                  <span className="flex flex-col">
                    <span className="text-[14px] font-medium leading-[18px] text-wds-text-ink">{p.name}</span>
                    <span className="text-[12px] leading-4 text-wds-text-secondary">{p.role}</span>
                  </span>
                </ListRow>
              ))}
            </div>
          }
          detail={
            <div className="p-6">
              <div className="flex items-center gap-4">
                <PersonAvatar name={sel} size="lg" />
                <div>
                  <div className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-wds-text-ink">{sel}</div>
                  <div className="text-[14px] text-wds-text-secondary">Detail for the chosen row</div>
                </div>
              </div>
              <button type="button" className="mt-4 text-[13px] text-wds-text-secondary underline md:hidden" onClick={() => setPhoneDetail(false)}>
                ‹ Back to the list (phone only)
              </button>
            </div>
          }
        />
        <p className="mt-2 text-[12px] text-wds-text-secondary">Below 768 px wide this shows the list, then the detail after a tap.</p>
      </div>
      <div>
        <Label>Stepper wizard</Label>
        <div className="border border-wds-border">
          <WizardLayout
            topBar={<WizardTopBar crumbs={['Employees', 'Add employee']} draft={<DraftIndicator text="Saved as a draft as you go" />} />}
            rail={
              <StepRail
                title="NEW EMPLOYEE"
                steps={[
                  { key: 'who', label: 'Who', state: 'current' },
                  { key: 'job', label: 'Job', state: 'upcoming' },
                  { key: 'pay', label: 'Pay', state: 'upcoming' },
                  { key: 'bank', label: 'Statutory and bank', state: 'upcoming' },
                  { key: 'login', label: 'Login', state: 'upcoming' },
                ]}
              />
            }
            form={
              <>
                <div>
                  <h2 className="m-0 text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-wds-text-ink">Who is joining?</h2>
                  <p className="mb-0 mt-2 text-[14px] leading-5 text-wds-text-secondary">The basics. The new person can add their own photo and details on their phone.</p>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="font-wds-mono text-[11px] tracking-[0.06em] text-wds-text-secondary">FULL NAME</span>
                  <input autoComplete="off" className="h-10 border border-wds-border-strong bg-wds-surface px-3 text-[14px] focus-visible:border-wds-primary focus-visible:shadow-wds-ring focus-visible:outline-none" defaultValue="Wanjiru Kamau" />
                </label>
              </>
            }
            panel={
              <FileSoFarPanel
                title="THE FILE SO FAR"
                percent={20}
                note="Wanjiru can be rostered once Who and Job are done. Pay and bank details are needed before payroll."
                rows={[
                  { key: 'who', label: 'Who', value: 'In progress', tone: 'progress' },
                  { key: 'job', label: 'Job', value: 'Next · HR or Branch Manager' },
                  { key: 'pay', label: 'Pay', value: 'HR only' },
                  { key: 'bank', label: 'Statutory and bank', value: 'HR, then Wanjiru' },
                  { key: 'login', label: 'Login', value: 'HR' },
                ]}
              />
            }
            footer={
              <WizardFooter
                stepText="Step 1 of 5"
                actions={
                  <>
                    <DialogButton kind="cancel" className="h-9">Save and close</DialogButton>
                    <DialogButton kind="primary" className="h-9 px-5">Continue to Job</DialogButton>
                  </>
                }
              />
            }
          />
        </div>
      </div>
    </Section>
  );
}
