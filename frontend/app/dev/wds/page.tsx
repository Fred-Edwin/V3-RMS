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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui2/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui2/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui2/toggle-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui2/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui2/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui2/avatar';
import { SearchInput } from '@/components/ui2/search-input';
import { SidebarNav, SidebarRail, type SidebarNavGroup } from '@/components/app/shell/sidebar-nav';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader, MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { KpiStrip, KpiRow } from '@/components/inventory/kpi-strip';
import { DrawerShell } from '@/components/inventory/drawer-shell';
import {
  ItemCatalogToolbar,
  ItemCatalogTable,
  ItemCatalogList,
  type ItemCatalogRow,
} from '@/components/inventory/item-catalog-table';
import {
  DashboardIcon,
  ReceivingIcon,
  PurchasingIcon,
  PrepIcon,
  DispatchIcon,
  StockCountsIcon,
  SuppliersIcon,
  SupplierApIcon,
  CatalogIcon,
  ReportsIcon,
} from '@/components/app/shell/nav-icons';

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

const demoCatalogRows: ItemCatalogRow[] = [
  { id: 'rice', name: 'Rice', type: 'raw', category: 'Dry goods', units: 'bag → kg · ÷25', pack: '25 kg', departmentScope: 'Central Store only' },
  { id: 'coffee', name: 'Coffee beans', type: 'stocked', category: 'Beverages', units: 'kg · no conversion', pack: '1 kg', departmentScope: 'Central Store · Barista' },
  { id: 'chicken', name: 'Chicken stock', type: 'prepped', category: 'Prepped bases', units: 'litres · no conversion', pack: '—', departmentScope: 'Central Store · Kitchen' },
  { id: 'milk', name: 'Milk', type: 'stocked', category: 'Dairy', units: 'crate → L · ÷12', pack: '12 L', departmentScope: 'Central Store · Kitchen, Barista' },
  { id: 'oil', name: 'Cooking oil', type: 'stocked', category: 'Dry goods', units: 'jerrican → L · ÷20', pack: '20 L', departmentScope: 'Central Store · Kitchen' },
  { id: 'vanilla', name: 'Vanilla syrup (retired)', type: 'stocked', category: 'Beverages', units: 'bottle → ml · ÷750', pack: '750 ml', departmentScope: 'Retired 04 Aug · history kept', retired: true },
];

const demoNavGroups: SidebarNavGroup[] = [
  {
    key: 'central-store',
    label: 'CENTRAL STORE',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '#', icon: DashboardIcon },
      { key: 'receiving', label: 'Receiving', href: '#', icon: ReceivingIcon, count: 3 },
      { key: 'purchasing', label: 'Purchasing', href: '#', icon: PurchasingIcon },
      { key: 'prep', label: 'Prep', href: '#', icon: PrepIcon },
      { key: 'dispatch', label: 'Dispatch', href: '#', icon: DispatchIcon, count: 5 },
      { key: 'stock-counts', label: 'Stock & counts', href: '#', icon: StockCountsIcon },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    items: [
      { key: 'suppliers', label: 'Suppliers', href: '#', icon: SuppliersIcon },
      { key: 'supplier-ap', label: 'Supplier AP', href: '#', icon: SupplierApIcon },
      { key: 'catalog', label: 'Catalog', href: '#', icon: CatalogIcon },
      { key: 'reports', label: 'Reports', href: '#', icon: ReportsIcon },
    ],
  },
];

/* ---------------------------------------------------------------- page */

export default function WdsPreviewPage() {
  // Pixel-diff-only demos (e.g. a forced-open Sheet) use a fixed-position scrim
  // that covers the whole viewport and would contaminate every other section's
  // screenshot if left mounted by default. Opt in with ?diff=sheet when actually
  // diffing that primitive; the rest of the page stays clean otherwise.
  const [diffTarget, setDiffTarget] = React.useState<string | null>(null);
  React.useEffect(() => {
    setDiffTarget(new URLSearchParams(window.location.search).get('diff'));
  }, []);
  const [drawerShellOpen, setDrawerShellOpen] = React.useState(false);

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

        {/* ---- Sheet / Drawer ---- */}
        <Section
          title="Sheet / Drawer"
          note="Right-anchored slide-over, 500px, scrim covers the full artboard. Reference: Paper SKV-0 (Scrim + Drawer)."
        >
          <div className="flex flex-col gap-wds-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Open drawer (interactive)</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>New item</SheetTitle>
                  <SheetDescription>
                    Type decides where the item can exist. Retiring later keeps all history.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-wds-6 py-wds-5">
                  <p className="font-wds-sans text-wds-body-sm text-wds-text">Drawer body content goes here.</p>
                </div>
                <SheetFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Create item</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {/*
              Forced-open real Sheet for pixel-diff screenshotting against the Paper
              1440x900 artboard. Uses the actual portal-rendered SheetOverlay/SheetContent
              (fixed, fills the viewport) — screenshot with the browser viewport set to
              1440x900. Its scrim covers the whole page, so it's opt-in only
              (?diff=sheet) rather than mounted by default — otherwise it contaminates
              every other section's screenshot below it on the page.
            */}
            {diffTarget === 'sheet' && (
              <Sheet open>
                <SheetContent id="sheet-pixel-diff-anchor" onEscapeKeyDown={(e) => e.preventDefault()}>
                  <SheetHeader>
                    <SheetTitle>New item</SheetTitle>
                    <SheetDescription>
                      Type decides where the item can exist. Retiring later keeps all history.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-wds-6 py-wds-5">
                    <p className="font-wds-sans text-wds-body-sm text-wds-text">Drawer body content goes here.</p>
                  </div>
                  <SheetFooter>
                    <Button variant="secondary">Cancel</Button>
                    <Button>Create item</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </Section>

        {/* ---- Select ---- */}
        <Section
          title="Select"
          note="Trigger matches Input exactly (h-8, radius 2, border-strong). Chevron is a plain ▾ glyph, not an icon. Reference: Paper SLU-0 (Category field)."
        >
          <div className="inline-block rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            {/* Bare, exact-width instance for pixel-diff — matches Paper SLU-0's 452px content width */}
            <div className="flex w-[452px] flex-col gap-wds-1.5 bg-wds-surface" id="select-pixel-diff-anchor">
              <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-muted">Category</span>
              <Select defaultValue="dry-goods">
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dry-goods">Dry goods</SelectItem>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="produce">Produce</SelectItem>
                </SelectContent>
              </Select>
              <span className="font-wds-sans text-wds-helper text-wds-text-faint">
                Pick from your list, or type a new name to add it. One category per item.
              </span>
            </div>
          </div>
        </Section>

        {/* ---- Toggle Group ---- */}
        <Section
          title="Toggle Group"
          note="Segmented control — joined segments, no gaps. Selected = espresso-700 fill (Paper-verified state). Reference: Paper SM0-0 (Type field)."
        >
          <div className="inline-block rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <div className="flex w-[452px] flex-col gap-wds-1.5 bg-wds-surface" id="toggle-group-pixel-diff-anchor">
              <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-muted">Type</span>
              <ToggleGroup type="single" defaultValue="raw">
                <ToggleGroupItem value="raw">Raw ingredient</ToggleGroupItem>
                <ToggleGroupItem value="prepped">Prepped</ToggleGroupItem>
                <ToggleGroupItem value="stocked">Stocked</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </Section>

        {/* ---- Table ---- */}
        <Section
          title="Table"
          note="Semantic <table> markup (Paper's own artboard is flex-row divs; real tabular data warrants real table semantics). Header 30px, bg-table-header-bg, border-b-ink. Rows 46px, border-b-neutral-100. Reference: Paper SFT-0 (Catalog table, first 2 rows)."
        >
          <div id="table-pixel-diff-anchor" className="w-[1140px]">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="h-[30px] hover:bg-wds-table-header-bg">
                  <TableHead className="w-[348px]">Name</TableHead>
                  <TableHead className="w-[120px] shrink-0 px-wds-2">Type</TableHead>
                  <TableHead className="w-[120px] shrink-0">Category</TableHead>
                  <TableHead className="w-[160px] shrink-0 px-wds-2">Units</TableHead>
                  <TableHead className="w-[110px] shrink-0 text-right">Pack</TableHead>
                  <TableHead className="w-[250px] shrink-0">Department scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-wds-text-ink">Rice</TableCell>
                  <TableCell className="w-[120px] shrink-0 px-wds-2">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-wds-caption text-wds-text-muted">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-wds-full bg-wds-neutral-400" aria-hidden />
                      Raw ingredient
                    </span>
                  </TableCell>
                  <TableCell className="w-[120px] shrink-0 text-wds-caption text-wds-text-ink">Dry goods</TableCell>
                  <TableCell className="w-[160px] shrink-0 whitespace-nowrap px-wds-2 font-wds-mono text-wds-caption text-wds-text-muted">
                    bag &rarr; kg &middot; &divide;25
                  </TableCell>
                  <TableCell className="w-[110px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-muted">
                    25 kg
                  </TableCell>
                  <TableCell className="w-[250px] shrink-0 text-wds-caption text-wds-text-faint">
                    Central Store only
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-wds-text-ink">Coffee beans</TableCell>
                  <TableCell className="w-[120px] shrink-0 px-wds-2">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-wds-caption text-wds-text-muted">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-wds-full bg-wds-info-fg" aria-hidden />
                      Stocked item
                    </span>
                  </TableCell>
                  <TableCell className="w-[120px] shrink-0 text-wds-caption text-wds-text-ink">Beverages</TableCell>
                  <TableCell className="w-[160px] shrink-0 whitespace-nowrap px-wds-2 font-wds-mono text-wds-caption text-wds-text-muted">
                    kg &middot; no conversion
                  </TableCell>
                  <TableCell className="w-[110px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-muted">
                    1 kg
                  </TableCell>
                  <TableCell className="w-[250px] shrink-0 text-wds-caption text-wds-text-faint">
                    Central Store &middot; Barista
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        {/* ---- Dropdown Menu ---- */}
        <Section
          title="Dropdown Menu"
          note="Filter chip trigger (py-0.5/px-2, border-strong, radius 2, caption text) + popover list, same convention-derived surface as Select. Reference: Paper SFT-0 toolbar (Type ▾ / Department ▾ / Category ▾)."
        >
          <div className="flex gap-wds-1.5 rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink">
                  Type ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Raw ingredient</DropdownMenuItem>
                <DropdownMenuItem>Prepped item</DropdownMenuItem>
                <DropdownMenuItem>Stocked item</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink">
                  Department ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Kitchen</DropdownMenuItem>
                <DropdownMenuItem>Barista</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Section>

        {/* ---- Avatar ---- */}
        <Section
          title="Avatar"
          note="Squared (radius 2), not round — the system's crisp-radii convention. Bespoke dark tile + muted text, sidebar-footer context. Reference: Paper SP6-0/SP7-0."
        >
          <div className="flex items-center gap-wds-3 rounded-wds-md border border-wds-border bg-wds-sidebar-top p-wds-6">
            <Avatar>
              <AvatarFallback>JM</AvatarFallback>
            </Avatar>
            <span className="font-wds-sans text-wds-body-sm text-wds-sidebar-fg-name">Joseph Mwangi</span>
          </div>
        </Section>

        {/* ---- Search Input ---- */}
        <Section
          title="Search Input"
          note="Input composition (icon + input + ⌘K hint), not a separate primitive. Real lucide Search icon in place of Paper's placeholder circle glyph. Reference: Paper SI9-0 (topbar search)."
        >
          <div className="max-w-[420px] rounded-wds-md border border-wds-border bg-wds-surface p-wds-6">
            <SearchInput />
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

      {/* ---- Composites: Sidebar Nav + Topbar ----
          These render at their real 1440px/1440px reference width, so they
          break out of the max-w-5xl text column above. */}
      <div className="border-t border-wds-border">
        <div className="flex flex-col gap-wds-8 px-wds-8 py-wds-12">
          <Section
            title="Hub Sidebar Nav"
            note="Cross-feature shared shell — components/app/shell/sidebar-nav.tsx. Role-conditional: one component, groups/items passed in. Desktop active state: no fill, no left marker — brighter label + 1.5px caramel underline (verified against the actual drawn node, not just Paper's summary note, which said 'same as mobile' — it isn't). Reference: Session-0 shell 18O-0."
          >
            <div className="h-[796px] w-[236px] overflow-hidden rounded-wds-md border border-wds-border">
              <SidebarNav
                groups={demoNavGroups}
                activeKey="dashboard"
                user={{ name: 'Joseph Mwangi', role: 'Store Manager', initials: 'JM' }}
              />
            </div>
          </Section>

          <Section
            title="Mobile Icon Rail"
            note="Same component family, mobile variant — flat items, no group labels, never a 'More' menu. Active state here IS left-border + bg-wash (verified against the actual drawn node — 1A5-0), distinct from desktop's underline-only treatment."
          >
            <div className="h-[520px] w-[60px] overflow-hidden rounded-wds-md border border-wds-border">
              <SidebarRail groups={demoNavGroups} activeKey="dispatch" user={{ initials: 'GW' }} />
            </div>
          </Section>

          <Section
            title="Mobile Hub Header"
            note="Cross-feature shared — components/app/shell/mobile-headers.tsx. Hamburger + org label + avatar, then title/subtitle. Always on the dark sidebar-mid ground. Reference: TM8-0."
          >
            <div className="w-[390px] max-w-full overflow-hidden rounded-wds-md border border-wds-border" id="mobile-hub-header-pixel-diff-anchor">
              <MobileStatusBar />
              <MobileHubHeader title="Item catalog" subtitle="148 items · raw, prepped, stocked" userInitials="JM" />
            </div>
          </Section>

          <Section
            title="Mobile Task Header"
            note="Back chevron + Cancel/Done + title/subtitle. Cancel for create/edit forms (TUY-0), Done for save-as-you-go screens like Restock Levels (TZO-0)."
          >
            <div className="flex flex-col gap-wds-4 sm:flex-row">
              <div className="w-[390px] max-w-full overflow-hidden rounded-wds-md border border-wds-border" id="mobile-task-header-cancel-pixel-diff-anchor">
                <MobileStatusBar />
                <MobileTaskHeader title="New item" subtitle="Type decides where the item can exist." trailingAction="Cancel" />
              </div>
              <div className="w-[390px] max-w-full overflow-hidden rounded-wds-md border border-wds-border">
                <MobileStatusBar />
                <MobileTaskHeader
                  title="Restock levels"
                  subtitle="Central Store items only. Store restock level drives the stock alerts."
                  trailingAction="Done"
                />
              </div>
            </div>
          </Section>

          <Section
            title="KPI Strip + KPI Stat Cell"
            note="Item Catalog dashboard stat row. Only the genuinely actionable number is accented — desktop: 1QN-0, mobile: TMQ-0."
          >
            <div className="flex flex-col gap-wds-4">
              <div className="w-[1100px] max-w-full">
                <KpiStrip
                  cells={[
                    { key: 'tracked', label: 'SKUs tracked', value: '248', detail: 'across 6 categories' },
                    {
                      key: 'value',
                      label: 'Stock value',
                      value: 'KES 1.84M',
                      trend: { tone: 'success', label: '+4.2% vs last count' },
                    },
                    { key: 'reorder', label: 'Below reorder', value: '12', tone: 'accent', detail: '4 critical' },
                    {
                      key: 'expiring',
                      label: 'Expiring ≤7d',
                      value: '3',
                      tone: 'warning',
                      detail: 'KES 21,400 at risk',
                    },
                  ]}
                />
              </div>
              <div className="w-[358px] max-w-full">
                <KpiRow
                  cells={[
                    { key: 'tracked', label: 'Tracked', value: '148' },
                    { key: 'scope', label: 'Needs scope', value: '3', tone: 'error' },
                    { key: 'retired', label: 'Retired', value: '6' },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Drawer Shell"
            note="Composite over the Sheet primitive — standard header (title + description) + footer (Cancel + primary) shared by all 4 Milestone One drawers. Reference: SMI-0/SKW-0 (Item create/edit)."
          >
            <div className="flex flex-col gap-wds-3">
              <Button variant="secondary" onClick={() => setDrawerShellOpen(true)}>
                Open Drawer Shell (interactive)
              </Button>
              <DrawerShell
                open={drawerShellOpen}
                onOpenChange={setDrawerShellOpen}
                title="New item"
                description="Type decides where the item can exist. Retiring later keeps all history."
                primaryLabel="Create item"
              >
                <div className="flex flex-col gap-wds-1.5">
                  <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-muted">Name</span>
                  <Input placeholder="Basmati rice" />
                </div>
              </DrawerShell>
            </div>
          </Section>

          <Section
            title="Item Catalog Table"
            note="Desktop table (toolbar + per-type status dot + retired-row 55% opacity) + mobile card list. Reference: SFT-0 (desktop) / TN1-0 (mobile)."
          >
            <div className="flex flex-col gap-wds-4">
              <div className="w-[1140px] max-w-full">
                <ItemCatalogToolbar
                  itemCount={148}
                  className="rounded-t-wds-md border border-b-0 border-wds-border"
                />
                <ItemCatalogTable rows={demoCatalogRows} />
              </div>
              <div className="w-[358px] max-w-full">
                <ItemCatalogList rows={demoCatalogRows} />
              </div>
            </div>
          </Section>

          <Section
            title="Desktop Topbar"
            note="Cross-feature shared shell — components/app/shell/topbar.tsx. Breadcrumb (section / screen · record-id) + global search + right-aligned page actions. 56px, wds-gradient-topbar (surface → topbar-end — bespoke #FCFBF9, not the espresso-50 tint; corrected this session, see Known issues). Reference: 1GO-0 / 1GS-0."
          >
            <div className="w-[1400px] max-w-full">
              <Topbar
                breadcrumb={{ section: 'Receiving', screen: 'Goods Receipt · GRN-1042' }}
                searchProps={{ placeholder: 'Search items, suppliers, receipts' }}
                actions={
                  <>
                    <Button variant="secondary" size="default">
                      Print
                    </Button>
                    <Button variant="primary" size="default">
                      Sign &amp; save
                    </Button>
                  </>
                }
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
