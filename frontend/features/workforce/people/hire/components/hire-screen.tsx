'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PermissionDeniedState } from '@/components/app/shell/shell-states';

import {
  Callout,
  DialogButton,
  DraftIndicator,
  ErrorBlock,
  FileSoFarPanel,
  ListSkeleton,
  StepRail,
  WizardFooter,
  WizardLayout,
  useWorkforcePermissions,
  type WizardStep,
} from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useLookups } from '../../_shared/hooks/use-people-data';
import { nairobiDay } from '../../_shared/lib/people-dates';
import { useHireWizard } from '../hooks/use-hire-wizard';
import { useReportsTo } from '../hooks/use-reports-to';
import { departmentsFor } from '../lib/hire-choices';
import { STEP_LABELS, STEP_NOTES, cap, firstNameOf, stepHeading } from '../lib/hire-copy';
import { hourlyEquivalent, hourlyWorking } from '../lib/hire-figures';
import { isCasual } from '../lib/hire-model';
import { loginSummary } from '../lib/hire-summary';
import { CasualPanel, JobPanel, LoginPanel, PayPanel, StatutoryPanel } from './hire-panels';
import { JobStep } from './steps/job-step';
import { LoginStep } from './steps/login-step';
import { PayStep } from './steps/pay-step';
import { StatutoryStep } from './steps/statutory-step';
import { WhoStep } from './steps/who-step';

/**
 * Add employee, the hire wizard (Paper Chapter 2, steps 1 to 5 and the casual's three). It saves a draft as you go, checks for a
 * duplicate by ID, phone and email, and on the last step makes the hire. HR sees every step; someone who may not set pay (a Branch
 * Manager) stops after the job and HR finishes the file. Nothing here knows a role: the server's capabilities decide.
 */
export function HireScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const permissions = useWorkforcePermissions();
  const lookups = useLookups(permissions.ready);
  const today = React.useMemo(() => nairobiDay(), []);
  const canSetPay = permissions.can('payprofile.write');
  const wizard = useHireWizard({ lookups: lookups.data, canSetPay, today, resumeDraftId: params.get('draft') });
  const { state, step, steps, stepIndex } = wizard;
  const reports = useReportsTo(state.departmentId);
  const head = reports.head?.name ?? null;
  const first = firstNameOf(state.name);
  const casual = isCasual(state);
  const departmentName = lookups.data ? (departmentsFor(lookups.data, state.siteId).find((d) => d.id === state.departmentId)?.name ?? null) : null;
  const siteName = lookups.data?.organizations.find((s) => s.id === state.siteId)?.name ?? '';
  const last = stepIndex === steps.length - 1;

  const railSteps: WizardStep[] = steps.map((key, i) => ({ key, label: STEP_LABELS[key], state: i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'upcoming' }));
  const heading = stepHeading(step, first, casual);

  const finish = async () => {
    const result = await wizard.submit();
    if (result) router.replace(`/app/workforce/employees/${result.employee.id}?hired=1${result.login.created || casual || !canSetPay ? '' : '&login=0'}`);
  };
  const saveAndClose = async () => {
    if (await wizard.saveDraftNow()) router.push('/app/workforce/employees');
  };

  const crumbs = { section: 'Employees', sectionHref: '/app/workforce/employees', screen: 'Add employee' };
  const draftText = casual ? STEP_NOTES.casualSteps : STEP_NOTES.draftSaved;
  const draft = <DraftIndicator text={wizard.draftStatus === 'failed' ? 'The draft did not save. Your answers are still here.' : draftText} saving={wizard.draftStatus === 'saving'} />;

  if (permissions.failed) {
    return (
      <PeopleFrame breadcrumb={crumbs} phoneTitle="Add employee" label="Add employee">
        <div className="p-8"><ErrorBlock title="Your access did not load" line="Try again in a moment." onRetry={permissions.retry} /></div>
      </PeopleFrame>
    );
  }
  if (permissions.ready && !permissions.can('employee.write_basic')) {
    return (
      <PeopleFrame breadcrumb={crumbs} phoneTitle="Add employee" label="Add employee">
        <div className="p-8"><PermissionDeniedState description="Adding an employee is for HR and for Branch and Store Managers on their own site." /></div>
      </PeopleFrame>
    );
  }
  if (!permissions.ready || lookups.status === 'loading') {
    return (
      <PeopleFrame breadcrumb={crumbs} phoneTitle="Add employee" label="Add employee">
        <div className="p-8"><ListSkeleton rows={5} columns={[160, 'fill']} label="Loading the form" /></div>
      </PeopleFrame>
    );
  }
  if (!lookups.data) {
    return (
      <PeopleFrame breadcrumb={crumbs} phoneTitle="Add employee" label="Add employee">
        <div className="p-8"><ErrorBlock title="The form did not load" line="Nothing was lost. Try again." onRetry={lookups.reload} /></div>
      </PeopleFrame>
    );
  }

  const stepProps = { state, errors: wizard.errors, set: wizard.set };
  const form = (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{heading.title}</h1>
        <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{heading.lead}</p>
      </div>
      {wizard.submitError ? <Callout tone="error" role="alert">{wizard.submitError}</Callout> : null}
      {step === 'who' ? <WhoStep {...stepProps} photo={wizard.photo} onPhoto={wizard.setPhoto} duplicate={wizard.duplicate} /> : null}
      {step === 'job' ? <JobStep {...stepProps} setJob={wizard.setJob} lookups={lookups.data} today={today} reports={reports} /> : null}
      {step === 'pay' ? <PayStep {...stepProps} departmentLabel={`${departmentName ?? ''} · ${siteName}`} /> : null}
      {step === 'statutory' ? <StatutoryStep {...stepProps} /> : null}
      {step === 'login' ? <LoginStep {...stepProps} lookups={lookups.data} summary={loginSummary(state, lookups.data, head)} /> : null}
    </>
  );

  const hourly = hourlyEquivalent(casual, state.amount, state.weekHours, state.dayHours);
  const panel =
    step === 'who' ? (
      <FileSoFarPanel
        title="THE FILE SO FAR"
        percent={Math.round(100 / steps.length)}
        note={`${cap(first)} can be rostered once Who and Job are done. Pay and bank details are needed before payroll.`}
        rows={steps.map((key, i) => ({
          key,
          label: STEP_LABELS[key],
          value: i === 0 ? 'In progress' : key === 'job' ? 'Next · HR or the site manager' : key === 'pay' ? 'HR only' : key === 'statutory' ? `HR, then ${first}` : 'HR',
          tone: i === 0 ? ('progress' as const) : ('default' as const),
        }))}
      />
    ) : step === 'job' ? (
      <JobPanel first={first} department={departmentName} head={head} canSetPay={canSetPay} />
    ) : step === 'pay' && casual ? (
      <CasualPanel first={first} head={head} manager="The site manager" />
    ) : step === 'pay' ? (
      <PayPanel first={first} hourly={hourly} working={hourlyWorking(casual, state.amount, state.weekHours, state.dayHours)} />
    ) : step === 'statutory' ? (
      <StatutoryPanel first={first} />
    ) : (
      <LoginPanel first={first} head={head} department={departmentName} />
    );

  const nextLabel = steps[stepIndex + 1] ? `Continue to ${STEP_LABELS[steps[stepIndex + 1] as keyof typeof STEP_LABELS]}` : '';
  const finishLabel = casual ? `Add ${first} to the pool` : `Hire ${first}`;
  const actions = (
    <>
      {stepIndex === 0 ? (
        <DialogButton kind="cancel" size="lg" onClick={saveAndClose}>Save and close</DialogButton>
      ) : (
        <DialogButton kind="cancel" size="lg" onClick={wizard.back}>Back</DialogButton>
      )}
      <DialogButton kind="primary" size="lg" disabled={wizard.submitting} onClick={last ? finish : wizard.next}>
        {last ? (wizard.submitting ? 'Hiring…' : finishLabel) : nextLabel}
      </DialogButton>
    </>
  );

  return (
    <PeopleFrame breadcrumb={crumbs} phoneTitle="Add employee" label="Add employee" actions={<div className="pr-2">{draft}</div>}>
      <WizardLayout
        className="min-h-full"
        topBar={null}
        rail={<StepRail title={state.name.trim() ? `${state.name.trim().toUpperCase()}${casual ? ' · CASUAL' : ''}` : 'NEW EMPLOYEE'} steps={railSteps} />}
        form={form}
        panel={panel}
        footer={<WizardFooter stepText={`Step ${stepIndex + 1} of ${steps.length}`} actions={actions} />}
      />
    </PeopleFrame>
  );
}
