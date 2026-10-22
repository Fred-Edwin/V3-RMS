import type { ReactNode } from 'react';
import Image from 'next/image';
import { Eye, Layers, BarChart3, MessageCircle } from 'lucide-react';

import { SUPPORT_LINE, WHATSAPP_URL } from '../lib/signin-rules';

/**
 * The frame every sign-in screen sits in (Paper 3.1, 3.2, 4.1 to 4.5): the brand panel on the left on a computer (560 px, gradient and
 * grain), a centred hero on top on a phone, the white column with the card, and the support strip at the bottom.
 */

const PANEL_BACKGROUND =
  'radial-gradient(ellipse 110% 70% at 100% 100% in oklab, #82281E80 0%, #82281E00 68%), linear-gradient(in oklab 160deg, #8A5224 0%, #77461F 14%, #5F3519 30%, #472312 48%, #2F160D 66%, #200E0A 84%, #170807 100%)';

/** The grain: fractal noise at 35%, blended over the gradient. Decorative. */
function Grain(): JSX.Element {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
      <filter id="signin-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#signin-grain)" fill="#000" />
    </svg>
  );
}

function Badge({ size }: { size: number }): JSX.Element {
  return <Image src="/images/wendo-logo.jpg" alt="" width={size} height={size} priority className="rounded-full border-[1.5px] border-[#D9A65EB3] bg-[#4E2C14] object-cover" />;
}

function Name({ className }: { className: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center font-wds-sans tracking-[-0.03em]">
      <span className={`font-semibold text-[#F7EFE4] ${className}`}>Wendo Coffee</span>
      <span className={`font-light text-[#E3B877] ${className}`}>Bistro</span>
    </div>
  );
}

/*
 * The three proof points. The Paper copy says "Real-time visibility"; the product refreshes on demand and on a few live screens, not
 * everywhere, so the first line says what is true: "Every branch in one place".
 */
const PROOF: ReadonlyArray<{ icon: JSX.Element; title: string; body: string }> = [
  { icon: <Eye size={22} strokeWidth={1.6} />, title: 'Every branch in one place', body: 'Sales, orders and stock across all your branches.' },
  { icon: <Layers size={22} strokeWidth={1.6} />, title: 'One record for your whole network', body: 'Staff, stock, cash and payroll tracked in every branch and operation.' },
  { icon: <BarChart3 size={22} strokeWidth={1.6} />, title: 'Decisions driven by data', body: 'Every sale, shift and stock count becomes clear insight for confident, data-driven decisions.' },
];

function BrandPanel(): JSX.Element {
  return (
    <aside className="relative hidden w-[560px] shrink-0 flex-col justify-between overflow-hidden px-14 pb-10 pt-14 lg:flex" style={{ backgroundImage: PANEL_BACKGROUND }}>
      <Grain />
      <div className="relative flex flex-col items-center gap-[18px] pt-6">
        <Badge size={112} />
        <Name className="text-[40px] leading-[44px]" />
      </div>
      <div className="relative flex flex-col gap-7">
        <h2 className="max-w-[340px] font-wds-sans text-[34px] font-semibold leading-[40px] tracking-[-0.03em] text-[#F7EFE4]">Run every branch from one place.</h2>
        <ul className="flex flex-col gap-5">
          {PROOF.map((p) => (
            <li key={p.title} className="flex gap-[14px]">
              <span className="mt-0.5 shrink-0 text-[#E3B877]">{p.icon}</span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-base font-semibold leading-5 text-[#F7EFE4]">{p.title}</span>
                <span className="text-sm leading-5 text-[#CDBFAE]">{p.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative flex items-center justify-between border-t border-[#F7EFE424] pt-[18px] text-xs">
        <span className="text-[#CDBFAE]">Built and supported by Fred</span>
        <a href={WHATSAPP_URL} className="flex items-center gap-1.5 font-medium text-[#E3B877] hover:underline" target="_blank" rel="noreferrer">
          <MessageCircle size={14} strokeWidth={1.8} aria-hidden />
          WhatsApp +254 113 176 613
        </a>
      </div>
    </aside>
  );
}

/** On a phone the panel becomes a hero: the badge and the name, same gradient and grain. */
function PhoneHero({ compact }: { compact: boolean }): JSX.Element {
  return (
    <header className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden lg:hidden ${compact ? 'h-[200px]' : 'h-[260px]'}`} style={{ backgroundImage: PANEL_BACKGROUND }}>
      <Grain />
      <div className="relative flex flex-col items-center gap-3">
        <Badge size={compact ? 64 : 80} />
        <Name className={compact ? 'text-[26px] leading-[28px]' : 'text-[30px] leading-[34px]'} />
      </div>
    </header>
  );
}

export function SigninShell({ children, compactHero = false }: { children: ReactNode; compactHero?: boolean }): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col bg-wds-canvas font-wds-sans text-wds-text lg:flex-row">
      <BrandPanel />
      <PhoneHero compact={compactHero} />
      <div className="flex min-w-0 flex-1 flex-col lg:border-l lg:border-[#D9A65E8C]">
        <div className="flex flex-1 items-start justify-center px-5 py-8 lg:items-center lg:px-0 lg:py-10">{children}</div>
        <footer className="flex shrink-0 items-center border-t border-wds-border px-5 py-4 text-[13px] leading-[18px] text-wds-neutral-700 lg:h-16 lg:px-10 lg:py-0">
          <a href={WHATSAPP_URL} className="hover:underline" target="_blank" rel="noreferrer">
            {SUPPORT_LINE}
          </a>
        </footer>
      </div>
    </main>
  );
}
