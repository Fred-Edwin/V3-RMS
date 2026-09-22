import * as React from 'react';
import type { NavIcon } from '@/components/app/shell/nav-icons';

/**
 * Branch Manager workspace nav icons. Only "Requisitions" is a live screen
 * this session (it reuses the hub's `CatalogIcon` shape from
 * `components/app/shell/nav-icons`); Branch/Deliveries/Day/Waste are
 * placeholder links (`href: '#'`) with no dedicated Paper icon drawn yet —
 * these are simple generic glyphs in the same stroke style, not final art,
 * matching how `inventory-shell.tsx` renders its own not-yet-built items.
 */
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

export const BranchIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 9.5 12 3l9 6.5V21H3z" />
    <path d="M9 21v-7h6v7" />
  </svg>
);

export const DeliveriesIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="1" y="6" width="15" height="12" rx="1" />
    <path d="M16 10h4l3 3v5h-7z" />
    <circle cx="6" cy="19.5" r="1.5" />
    <circle cx="18" cy="19.5" r="1.5" />
  </svg>
);

export const DayIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const WasteIcon: NavIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
