/**
 * WDS preview — the new design system as it came out of the code export.
 * Public route (no auth): http://localhost:3000/dev/wds
 *
 * Everything here reads the real codified tokens (app/tokens.wds.css via the
 * tailwind.wds.preset.ts `wds-*` utilities). Use it to verify colours,
 * gradients, type, and the ui2 primitives against the Paper design.
 *
 * This is a dev aid, not shipped UI. It is not restyled per-feature.
 */
'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { Label } from '@/components/ui2/label';
import { Badge } from '@/components/ui2/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui2/card';
import { Separator } from '@/components/ui2/separator';
import { Skeleton } from '@/components/ui2/skeleton';
import { StatusDot } from '@/components/ui2/status-dot';

/* ---------------------------------------------------------------- helpers */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-wds-4 border-t border-wds-border pt-wds-8">
      <div className="flex flex-col gap-wds-1">
        <h2 className="font-wds-sans text-wds-h2 text-wds-text-ink">{title}</h2>
        {note ? <p className="font-wds-sans text-wds-caption text-wds-text-secondary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className, value }: { name: string; className: string; value: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border">
      <div className={`h-16 ${className}`} />
      <div className="flex flex-col gap-px border-t border-wds-border bg-wds-surface px-wds-2 py-wds-2">
        <span className="font-wds-mono text-wds-mono-sm text-wds-text-ink">{name}</span>
        <span className="font-wds-mono text-wds-mono-sm text-wds-text-muted">{value}</span>
      </div>
    </div>
  );
}

function GradientSwatch({ name, className, note }: { name: string; className: string; note: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border">
      <div className={`h-24 ${className}`} />
      <div className="flex flex-col gap-px border-t border-wds-border bg-wds-surface px-wds-3 py-wds-2">
        <span className="font-wds-mono text-wds-mono-sm text-wds-text-ink">{name}</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-secondary">{note}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function WdsPreviewPage() {
  return (
    <div className="min-h-screen bg-wds-canvas">
      <div className="mx-auto flex max-w-5xl flex-col gap-wds-8 px-wds-8 py-wds-12">
        <header className="flex flex-col gap-wds-2">
          <span className="font-wds-mono text-wds-mono-sm uppercase tracking-[0.08em] text-wds-text-muted">
            Wendo RMS · Design System · code export preview
          </span>
          <h1 className="font-wds-sans text-wds-display text-wds-text-ink">wds-* tokens &amp; ui2 primitives</h1>
          <p className="max-w-2xl font-wds-sans text-wds-body text-wds-text-secondary">
            Rendered from the real codified tokens. Compare against the Paper file
            (01M1ZZJ6S3FZGF5C7PPBGTKY89). Dev aid only — not shipped UI.
          </p>
        </header>

        {/* ---- Neutrals ---- */}
        <Section title="Neutrals" note="Warm-cast near-neutral. Canvas is 0. No warmth visible on a single surface.">
          <div className="grid grid-cols-2 gap-wds-3 sm:grid-cols-4 lg:grid-cols-6">
            <Swatch name="neutral-0" className="bg-wds-neutral-0" value="#FCFCFC" />
            <Swatch name="neutral-50" className="bg-wds-neutral-50" value="#F6F5F3" />
            <Swatch name="neutral-100" className="bg-wds-neutral-100" value="#EEEDEA" />
            <Swatch name="neutral-200" className="bg-wds-neutral-200" value="#E4E2DE" />
            <Swatch name="neutral-300" className="bg-wds-neutral-300" value="#D2CFC9" />
            <Swatch name="neutral-400" className="bg-wds-neutral-400" value="#A8A39B" />
            <Swatch name="neutral-500" className="bg-wds-neutral-500" value="#847E76" />
            <Swatch name="neutral-600" className="bg-wds-neutral-600" value="#635E57" />
            <Swatch name="neutral-700" className="bg-wds-neutral-700" value="#47433D" />
            <Swatch name="neutral-800" className="bg-wds-neutral-800" value="#2E2B27" />
            <Swatch name="neutral-950" className="bg-wds-neutral-950" value="#171512" />
          </div>
        </Section>

        {/* ---- Espresso ---- */}
        <Section title="Espresso — primary accent" note="Anchored on #693C1B (700). Structural: buttons, active nav, rings, links.">
          <div className="grid grid-cols-2 gap-wds-3 sm:grid-cols-4 lg:grid-cols-8">
            <Swatch name="espresso-50" className="bg-wds-espresso-50" value="#F8F2EC" />
            <Swatch name="espresso-100" className="bg-wds-espresso-100" value="#EEDDCC" />
            <Swatch name="espresso-200" className="bg-wds-espresso-200" value="#DDBE9E" />
            <Swatch name="espresso-400" className="bg-wds-espresso-400" value="#B98A5E" />
            <Swatch name="espresso-600" className="bg-wds-espresso-600" value="#8B5A32" />
            <Swatch name="espresso-700" className="bg-wds-espresso-700" value="#693C1B" />
            <Swatch name="espresso-800" className="bg-wds-espresso-800" value="#4E2C14" />
            <Swatch name="espresso-900" className="bg-wds-espresso-900" value="#33200F" />
          </div>
        </Section>

        {/* ---- Caramel ---- */}
        <Section title="Caramel / crema — secondary accent" note="Grace notes only, never a fill. Nav underlines, KPI trend, chart series.">
          <div className="grid grid-cols-2 gap-wds-3 sm:grid-cols-5">
            <Swatch name="caramel-100" className="bg-wds-caramel-100" value="#FCF2E4" />
            <Swatch name="caramel-300" className="bg-wds-caramel-300" value="#EFCF9E" />
            <Swatch name="caramel-500" className="bg-wds-caramel-500" value="#D9A65E" />
            <Swatch name="caramel-600" className="bg-wds-caramel-600" value="#B5823E" />
            <Swatch name="caramel-700" className="bg-wds-caramel-700" value="#8C6230" />
          </div>
        </Section>

        {/* ---- Semantic ---- */}
        <Section title="Semantic" note="fg / bg / border per state. Warm two lean toward the coffee family.">
          <div className="grid grid-cols-1 gap-wds-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-success-border bg-wds-success-bg p-wds-4">
              <span className="font-wds-sans text-wds-label text-wds-success-fg">Success</span>
              <span className="font-wds-mono text-wds-mono-sm text-wds-success-fg">text on subtle bg</span>
            </div>
            <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-warning-border bg-wds-warning-bg p-wds-4">
              <span className="font-wds-sans text-wds-label text-wds-warning-fg">Warning</span>
              <span className="font-wds-mono text-wds-mono-sm text-wds-warning-fg">text on subtle bg</span>
            </div>
            <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-error-border bg-wds-error-bg p-wds-4">
              <span className="font-wds-sans text-wds-label text-wds-error-fg">Error</span>
              <span className="font-wds-mono text-wds-mono-sm text-wds-error-fg">text on subtle bg</span>
            </div>
            <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-info-border bg-wds-info-bg p-wds-4">
              <span className="font-wds-sans text-wds-label text-wds-info-fg">Info</span>
              <span className="font-wds-mono text-wds-mono-sm text-wds-info-fg">text on subtle bg</span>
            </div>
          </div>
        </Section>

        {/* ---- Gradients ---- */}
        <Section title="Gradients" note="The only six. Everything else is flat.">
          <div className="grid grid-cols-1 gap-wds-4 sm:grid-cols-2 lg:grid-cols-3">
            <GradientSwatch name="wds-gradient-sidebar" className="bg-wds-gradient-sidebar" note="nav rail — coffee at top, dark at bottom" />
            <GradientSwatch name="wds-gradient-primary" className="bg-wds-gradient-primary" note="primary button, active nav marker" />
            <GradientSwatch name="wds-gradient-surface-raise" className="bg-wds-gradient-surface-raise" note="KPI / stat cards" />
            <GradientSwatch name="wds-gradient-topbar" className="bg-wds-gradient-topbar" note="top bar" />
            <GradientSwatch name="wds-gradient-brand" className="bg-wds-gradient-brand" note="logo tile only (135°)" />
            <GradientSwatch name="wds-gradient-skeleton" className="bg-wds-gradient-skeleton bg-[length:200%_100%] animate-wds-skeleton" note="loading — neutral, not espresso" />
          </div>
        </Section>

        {/* ---- Typography ---- */}
        <Section title="Typography" note="Geist for UI, Geist Mono for numerics.">
          <div className="flex flex-col gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <p className="font-wds-sans text-wds-display text-wds-text-ink">Central Store</p>
            <p className="font-wds-sans text-wds-h1 text-wds-text-ink">Purchase orders</p>
            <p className="font-wds-sans text-wds-h2 text-wds-text-ink">Stock count — 6 Sep</p>
            <p className="font-wds-sans text-wds-h3 text-wds-text-ink">Reorder recommendations</p>
            <p className="font-wds-sans text-wds-body text-wds-text">
              Body — Arabica beans, house blend: 48.0 kg on hand against a 20 kg reorder point.
            </p>
            <p className="font-wds-sans text-wds-body-sm text-wds-text">Body-sm — the default for dense table rows.</p>
            <p className="font-wds-sans text-wds-caption text-wds-text-secondary">Caption — last counted 6 Sep 2026, 07:40</p>
            <p className="font-wds-sans text-wds-overline uppercase text-wds-text-secondary">Overline — operations</p>
            <p className="font-wds-mono text-wds-mono text-wds-text-ink">Mono — KES 1,180.00 · 48.0 kg · SKU-1042</p>
          </div>
        </Section>

        {/* ---- Buttons ---- */}
        <Section title="Button" note="Height 32 (sm 28, lg 36), radius 2. Espresso gradient + sheen on primary.">
          <div className="flex flex-wrap items-center gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <Button>Create order</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        {/* ---- Inputs ---- */}
        <Section title="Input & Label">
          <div className="flex max-w-sm flex-col gap-wds-2 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <Label htmlFor="supplier">Supplier</Label>
            <Input id="supplier" placeholder="Nyeri Dairy Co-op" />
            <Input placeholder="Disabled" disabled />
            <Input placeholder="Invalid" aria-invalid />
          </div>
        </Section>

        {/* ---- Status ---- */}
        <Section title="Status — dot + label, no fill">
          <div className="flex flex-wrap items-center gap-wds-6 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <StatusDot tone="success">In stock</StatusDot>
            <StatusDot tone="warning">Low</StatusDot>
            <StatusDot tone="error">Critical</StatusDot>
            <StatusDot tone="info">Expiring 4d</StatusDot>
            <StatusDot tone="neutral">Draft</StatusDot>
          </div>
        </Section>

        {/* ---- Badges ---- */}
        <Section title="Badge" note="Counts (nav / tabs) + semantic tags. Row status uses StatusDot.">
          <div className="flex flex-wrap items-center gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <Badge variant="neutral">24</Badge>
            <Badge variant="primary">12</Badge>
            <Badge variant="success">Approved</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="error">Rejected</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Section>

        {/* ---- Card ---- */}
        <Section title="Card" note="Border-led, radius 4. `raised` adds the subtle surface wash (KPI cards).">
          <div className="grid grid-cols-1 gap-wds-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Flat card</CardTitle>
                <CardDescription>Default surface, 1px border, no shadow.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-wds-sans text-wds-body-sm text-wds-text">Panel content.</p>
              </CardContent>
            </Card>
            <Card raised>
              <CardHeader>
                <span className="font-wds-mono text-wds-mono-sm uppercase tracking-[0.04em] text-wds-text-secondary">
                  Stock value
                </span>
                <span className="font-wds-mono text-[28px] font-medium leading-none text-wds-text-ink">KES 1.84M</span>
                <span className="mt-wds-1 inline-flex items-center gap-wds-1">
                  <span className="h-1.5 w-1.5 rounded-wds-full bg-wds-success-fg" />
                  <span className="font-wds-sans text-wds-caption text-wds-success-fg">+4.2% vs last count</span>
                </span>
              </CardHeader>
            </Card>
          </div>
        </Section>

        {/* ---- Separator + Skeleton ---- */}
        <Section title="Separator & Skeleton">
          <div className="flex flex-col gap-wds-4 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <p className="font-wds-sans text-wds-body-sm text-wds-text">Above the rule</p>
            <Separator />
            <p className="font-wds-sans text-wds-body-sm text-wds-text">Below the rule</p>
            <div className="flex flex-col gap-wds-2 pt-wds-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
