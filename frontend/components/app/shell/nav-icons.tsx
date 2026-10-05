import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Hub sidebar nav icons — inline SVGs matching Paper's exact paths (Session-0
 * shell, `18O-0`/`1A5-0`), not swapped for a lucide equivalent. Unlike
 * SearchInput's placeholder-circle deviation, these are meaningful glyphs
 * Paper deliberately drew per nav item, so they're reproduced 1:1.
 */
export type NavIcon = React.FC<React.SVGProps<SVGSVGElement>>;

const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const DashboardIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </svg>
);

export const ReceivingIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2" />
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 12h6" />
  </svg>
);

export const PurchasingIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

export const PrepIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
  </svg>
);

export const DispatchIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M10 17h4V5H2v12h3" />
    <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
    <circle cx="7.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

export const StockCountsIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M20 7 12 3 4 7l8 4 8-4Z" />
    <path d="m4 7 8 4v10l-8-4V7Z" />
    <path d="m20 7-8 4v10l8-4V7Z" />
  </svg>
);

export const SuppliersIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9h.01M9 12h.01M9 15h.01" />
  </svg>
);

export const SupplierApIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

export const CatalogIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

export const ReportsIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

/** Audit log — Paper's clipboard glyph (approved sidebar, "Parts · sidebars"): the record that cannot be edited. */
export const AuditLogIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" />
  </svg>
);

/** Settings — lucide-style gear-less "sun" glyph matching Paper artboard 1 (Pre-Demo · Team & PIN): a centre ring with eight spokes. */
export const SettingsIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
);

/**
 * Sign-out glyph — Paper never draws a sign-out control anywhere in the
 * sidebar footer, so there's no node to source this from. Same deviation
 * category as SearchInput's lucide Search icon: a real, standard glyph
 * (lucide's `log-out`) rather than inventing bespoke path data.
 */
export const SignOutIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/**
 * Lucide glyphs for the links to pages that are not rebuilt yet (`nav-table.ts`). Paper's master draws every sidebar icon as a
 * lucide path at 15px with a 1.75 stroke, so this gives a lucide icon exactly that, and a rebuilt feature can swap in its own
 * inline icon above without the sidebar changing.
 */
export function fromLucide(Icon: LucideIcon): NavIcon {
  const Wrapped: NavIcon = (props) => <Icon size={15} strokeWidth={1.75} {...(props as Omit<typeof props, 'ref'>)} />;
  Wrapped.displayName = `NavIcon(${Icon.displayName ?? 'icon'})`;
  return Wrapped;
}

/**
 * Hamburger glyph for the mobile hub header's menu button — Paper's `TM8-0`
 * draws this as a placeholder/generic icon; a standard 3-line hamburger is
 * the conventional real-world equivalent.
 */
export const MenuIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
