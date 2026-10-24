'use client';

import * as React from 'react';

import {
  ClockCard,
  DayCard,
  DayStrip,
  OptionList,
  PhoneButton,
  PhoneDarkHeader,
  PhoneHero,
  PhonePrompt,
  TimeRow,
  TimerChip,
  WeekBars,
  formatHms,
  formatHoursMinutes,
} from '../..';
import { Label, Section } from '../gallery-parts';

function Phone({ children, label, height = 852 }: { children: React.ReactNode; label: string; height?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex w-[390px] max-w-full flex-col overflow-hidden border border-wds-border-strong bg-wds-neutral-50" style={{ minHeight: height }}>
        {children}
      </div>
    </div>
  );
}

const PLANNED_BARS = [
  { letter: 'M', fraction: 1, state: 'planned' as const, today: true, label: 'Monday, 8 hours planned' },
  { letter: 'T', fraction: 1, state: 'planned' as const, label: 'Tuesday, 8 hours planned' },
  { letter: 'W', fraction: 1, state: 'planned' as const, label: 'Wednesday, 8 hours planned' },
  { letter: 'T', fraction: 1, state: 'planned' as const, label: 'Thursday, 8 hours planned' },
  { letter: 'F', fraction: 1, state: 'planned' as const, label: 'Friday, 8 hours planned' },
  { letter: 'S', fraction: 0, state: 'off' as const, label: 'Saturday, day off' },
  { letter: 'S', fraction: 0, state: 'off' as const, label: 'Sunday, day off' },
];

/** The phone pieces, composed as in Paper's phone screens. */
export function PhoneSection() {
  const [day, setDay] = React.useState('sat');
  const [why, setWhy] = React.useState<string | null>('busy');
  const [seconds, setSeconds] = React.useState(15140);
  React.useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <Section id="phone" title="18 · Phone pieces" node="19US-0 / 19XI-0 / 1CGJ-0 / 1CHM-0 / 199C-0 / 19FF-0 / 19FR-0" note="Each frame is 390 px wide like Paper's. The timer on the second one runs. Build width checks with the emulate tool at 390 by 844.">
      <div className="flex flex-wrap items-start gap-8">
        <Phone label="Home · before the shift (19US-0)">
          <PhoneDarkHeader kicker="WENDO RMS · NYERI TOWN" trailing={<TimerChip tone="grey" time="06:00" label="Shift starts at" />} />
          <PhoneHero name="Amina Hassan" greeting="Good morning, Amina" subtitle="Monday 12 October · Nyeri Town" />
          <div className="-mt-8 flex flex-col gap-3.5 p-4">
            <ClockCard
              shiftLabel="MORNING · 06:00 TO 14:00"
              statusLabel="NOT IN YET"
              timer={formatHms(720)}
              caption="until your shift starts. Clock in opens at 05:45."
              actions={<PhoneButton size="md">Clock in</PhoneButton>}
              helper="Your phone checks you are at Nyeri Town."
            />
            <WeekBars title="This week" range="12 TO 18 OCT" bars={PLANNED_BARS} caption="40 h planned · grey bars become green as you work them" />
          </div>
        </Phone>

        <Phone label="Home · on shift (19XI-0), live timer">
          <PhoneDarkHeader kicker="WENDO RMS · NYERI TOWN" trailing={<TimerChip tone="green" time="4:12" label="On shift for" />} />
          <PhoneHero name="Amina Hassan" greeting="Good morning, Amina" subtitle="Monday 12 October · Nyeri Town" />
          <div className="-mt-8 flex flex-col gap-3.5 p-4">
            <ClockCard
              shiftLabel="MORNING · 06:00 TO 14:00"
              statusLabel="ON SHIFT"
              statusTone="on"
              timer={formatHms(seconds)}
              caption="In at 05:58. Your shift ends in 3 h 48 m."
              progress={{ percent: 52, ticks: ['06', '08', '10', '12', '14'], label: 'Shift progress' }}
              actions={<PhoneButton kind="brownOutline" size="sm">Clock out</PhoneButton>}
            />
          </div>
        </Phone>

        <Phone label="My rota (1CGJ-0) and hours (1CHM-0) headers, day cards, time rows">
          <PhoneDarkHeader kicker="MY TIME · ROTA" onBack={() => undefined} title="12 to 18 October" subtitle="5 shifts · 40 h planned · published Fri 9 Oct" />
          <ul className="m-0 flex list-none flex-col gap-2 p-4">
            <DayCard day="Mon 12" today shift={{ tone: 'morning', label: 'Morning 06:00 to 14:00' }} />
            <DayCard day="Tue 13" shift={{ tone: 'morning', label: 'Morning 06:00 to 14:00' }} />
            <DayCard day="Thu 15" shift={{ tone: 'afternoon', label: 'Afternoon 14:00 to 22:00' }} changedNote="Changed from Morning · Faith Njeri, 16:49" />
            <DayCard day="Sat 17" dayOff />
          </ul>
          <PhoneDarkHeader kicker="MY TIME · LAST WEEK" onBack={() => undefined} figure={formatHoursMinutes(38 * 60 + 10).replace(' h ', ' h ')} subtitle="worked, 5 to 11 October · Friday looks short" />
          <ul className="m-0 flex list-none flex-col gap-2 p-4">
            <TimeRow day="Mon 5" range="05:58 → 14:01" hours="8 h 03" />
            <TimeRow day="Fri 9" range="05:58 → 11:20" hours="5 h 22" state="problem" note="Clocked out early. Is this wrong?" report={{ label: 'Report a problem', onClick: () => undefined }} />
            <TimeRow day="Wed 7" range="05:59 → 14:00" hours="8 h 01" state="short" />
          </ul>
        </Phone>

        <Phone label="Day strip (199L-0)" height={0}>
          <DayStrip
            label="Day"
            value={day}
            onChange={setDay}
            days={[
              { value: 'mon', dow: 'MON', day: '12' },
              { value: 'tue', dow: 'TUE', day: '13' },
              { value: 'wed', dow: 'WED', day: '14' },
              { value: 'thu', dow: 'THU', day: '15' },
              { value: 'fri', dow: 'FRI', day: '16' },
              { value: 'sat', dow: 'SAT', day: '17' },
              { value: 'sun', dow: 'SUN', day: '18' },
            ]}
          />
        </Phone>

        <Phone label="Prompt layout (19FR-0): kicker, title, body, option list, button stack" height={780}>
          <PhonePrompt
            kicker="STAYING ON"
            title="Why are you staying?"
            body="One tap. Your manager sees this when they check overtime."
            actions={
              <>
                <PhoneButton size="lg">Stay on</PhoneButton>
                <PhoneButton kind="outlined">Finish now</PhoneButton>
              </>
            }
          >
            <OptionList legend="Why are you staying?" value={why} onChange={setWhy} options={[{ value: 'busy', label: 'Busy, customers waiting' }, { value: 'cover', label: 'Covering a colleague' }, { value: 'close', label: 'Closing or clean-up tasks' }, { value: 'asked', label: 'My manager asked me to' }]} />
            <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">Overtime is paid only after your manager approves it. If you do not answer in 15 minutes your shift closes at 14:00 and is flagged for your manager.</p>
          </PhonePrompt>
        </Phone>
      </div>
    </Section>
  );
}
