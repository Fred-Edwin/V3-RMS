/**
 * Chart color constants. Charts take hex color props / SVG attributes, so
 * token values are re-exported here as JS constants — keep these in sync
 * with `tailwind.config.ts`. Pages must import from this module instead of
 * writing literal hexes into chart props.
 */

/** `success` token — positive/revenue series */
export const CHART_SUCCESS = '#1A6B3C'

/** `amber` token — brand highlight series */
export const CHART_AMBER = '#C4862A'

/** Amber gradient stops used by bar/progress charts */
export const CHART_AMBER_DARK = '#92520D'
export const CHART_AMBER_LIGHT = '#F5C26B'

/** Categorical palette for multi-line branch series */
export const CHART_SERIES_PALETTE = [
  '#DC2626',
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#0D9488',
  '#7C3AED',
] as const
