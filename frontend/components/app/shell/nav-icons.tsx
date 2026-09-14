import * as React from 'react';

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
