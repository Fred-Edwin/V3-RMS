import type { Config } from 'tailwindcss';

/* ============================================================================
   Wendo Design System (WDS) — Tailwind preset
   ----------------------------------------------------------------------------
   Loaded via `presets: [wdsPreset]` in tailwind.config.ts. Every key here is
   namespaced `wds-*` so it cannot collide with the legacy warm theme in the
   main config. When the legacy components/ui/ is deleted, this file is folded
   into the main config and the `wds-` prefix is stripped in one pass.

   Values mirror app/tokens.wds.css. Colors reference the CSS custom properties
   so a token retune in that file flows through without editing this preset.
   ========================================================================== */

const wdsPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        'wds-canvas': 'var(--wds-canvas)',
        'wds-surface': 'var(--wds-surface)',
        'wds-surface-sunken': 'var(--wds-surface-sunken)',
        'wds-border': 'var(--wds-border)',
        'wds-border-strong': 'var(--wds-border-strong)',
        'wds-ring': 'var(--wds-ring)',
        'wds-scrim': 'var(--wds-scrim)',
        'wds-table-header-bg': 'var(--wds-table-header-bg)',

        'wds-neutral': {
          0: 'var(--wds-neutral-0)',
          50: 'var(--wds-neutral-50)',
          100: 'var(--wds-neutral-100)',
          200: 'var(--wds-neutral-200)',
          300: 'var(--wds-neutral-300)',
          400: 'var(--wds-neutral-400)',
          500: 'var(--wds-neutral-500)',
          600: 'var(--wds-neutral-600)',
          700: 'var(--wds-neutral-700)',
          800: 'var(--wds-neutral-800)',
          950: 'var(--wds-neutral-950)',
        },

        'wds-espresso': {
          50: 'var(--wds-espresso-50)',
          100: 'var(--wds-espresso-100)',
          200: 'var(--wds-espresso-200)',
          400: 'var(--wds-espresso-400)',
          600: 'var(--wds-espresso-600)',
          700: 'var(--wds-espresso-700)',
          800: 'var(--wds-espresso-800)',
          900: 'var(--wds-espresso-900)',
          DEFAULT: 'var(--wds-espresso-700)',
        },

        'wds-caramel': {
          100: 'var(--wds-caramel-100)',
          300: 'var(--wds-caramel-300)',
          500: 'var(--wds-caramel-500)',
          600: 'var(--wds-caramel-600)',
          700: 'var(--wds-caramel-700)',
          DEFAULT: 'var(--wds-caramel-500)',
        },

        'wds-primary': {
          DEFAULT: 'var(--wds-primary)',
          hover: 'var(--wds-primary-hover)',
          pressed: 'var(--wds-primary-pressed)',
          fg: 'var(--wds-primary-fg)',
        },

        'wds-text': {
          DEFAULT: 'var(--wds-text)',
          secondary: 'var(--wds-text-secondary)',
          // Decorative only — placeholders, icon fills, inert glyphs. Fail
          // WCAG AA as copy; see tokens.wds.css for the contrast figures.
          muted: 'var(--wds-text-muted)',
          faint: 'var(--wds-text-faint)',
          // Use these for any copy a user reads (helper text, captions,
          // field labels, unit annotations). AA-passing on both grounds.
          'copy-faint': 'var(--wds-text-copy-faint)',
          'copy-muted': 'var(--wds-text-copy-muted)',
          ink: 'var(--wds-text-ink)',
        },

        'wds-success': {
          fg: 'var(--wds-success-fg)',
          bg: 'var(--wds-success-bg)',
          border: 'var(--wds-success-border)',
        },
        'wds-warning': {
          fg: 'var(--wds-warning-fg)',
          bg: 'var(--wds-warning-bg)',
          border: 'var(--wds-warning-border)',
        },
        'wds-error': {
          fg: 'var(--wds-error-fg)',
          bg: 'var(--wds-error-bg)',
          border: 'var(--wds-error-border)',
        },
        'wds-info': {
          fg: 'var(--wds-info-fg)',
          bg: 'var(--wds-info-bg)',
          border: 'var(--wds-info-border)',
        },

        'wds-sidebar': {
          top: 'var(--wds-sidebar-top)',
          mid: 'var(--wds-sidebar-mid)',
          bottom: 'var(--wds-sidebar-bottom)',
          fg: 'var(--wds-sidebar-fg)',
          'fg-item': 'var(--wds-sidebar-fg-item)',
          'fg-active': 'var(--wds-sidebar-fg-active)',
          'fg-muted': 'var(--wds-sidebar-fg-muted)',
          'fg-name': 'var(--wds-sidebar-fg-name)',
          divider: 'var(--wds-sidebar-divider)',
          marker: 'var(--wds-sidebar-marker)',
          'active-bg': 'var(--wds-sidebar-active-bg)',
          'badge-bg': 'var(--wds-sidebar-badge-bg)',
          'badge-fg': 'var(--wds-sidebar-badge-fg)',
        },

        'wds-accent-strong': 'var(--wds-accent-strong)',

        'wds-avatar-bg': 'var(--wds-avatar-bg)',
        'wds-avatar-fg': 'var(--wds-avatar-fg)',
      },

      backgroundImage: {
        'wds-gradient-sidebar': 'var(--wds-gradient-sidebar)',
        'wds-gradient-primary': 'var(--wds-gradient-primary)',
        'wds-gradient-primary-hover': 'var(--wds-gradient-primary-hover)',
        'wds-gradient-surface-raise': 'var(--wds-gradient-surface-raise)',
        'wds-gradient-topbar': 'var(--wds-gradient-topbar)',
        'wds-gradient-scroll-scrim': 'var(--wds-gradient-scroll-scrim)',
        'wds-gradient-brand': 'var(--wds-gradient-brand)',
        'wds-gradient-skeleton': 'var(--wds-gradient-skeleton)',
      },

      fontFamily: {
        // GeistSans / GeistMono (geist npm package) register these var names.
        'wds-sans': ['var(--font-geist-sans)', 'Geist', 'system-ui', 'sans-serif'],
        'wds-mono': [
          'var(--font-geist-mono)',
          'Geist Mono',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },

      /* Type scale — px-locked, dense. Matches the Typography artboard. */
      fontSize: {
        'wds-display': ['34px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'wds-h1': ['26px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'wds-h2': ['20px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'wds-h3': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'wds-drawer-title': ['16px', { lineHeight: '20px', fontWeight: '600' }],
        'wds-mobile-title': ['24px', { lineHeight: '30px', fontWeight: '600' }],
        'wds-mobile-task-title': ['20px', { lineHeight: '24px', fontWeight: '600' }],
        'wds-body': ['14px', { lineHeight: '20px' }],
        'wds-body-sm': ['13px', { lineHeight: '19px' }],
        'wds-label': ['13px', { lineHeight: '16px', fontWeight: '500' }],
        'wds-caption': ['12px', { lineHeight: '16px' }],
        'wds-overline': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '600' }],
        'wds-field-label': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '400' }],
        'wds-table-label': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        'wds-helper': ['11px', { lineHeight: '14px', fontWeight: '400' }],
        'wds-mono': ['13px', { lineHeight: '18px' }],
        'wds-mono-sm': ['11px', { lineHeight: '14px' }],
        'wds-kpi': ['28px', { lineHeight: '34px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'wds-kpi-sm': ['22px', { lineHeight: '28px', fontWeight: '500' }],
        'wds-kpi-label-sm': ['10px', { lineHeight: '12px', letterSpacing: '0.04em', fontWeight: '400' }],
      },

      /* 4px base — only the steps the system actually uses. */
      spacing: {
        'wds-0.5': '2px',
        'wds-1': '4px',
        'wds-1.5': '6px',
        'wds-2': '8px',
        'wds-2.5': '10px',
        'wds-3': '12px',
        'wds-3.5': '14px',
        'wds-4': '16px',
        'wds-4.5': '18px',
        'wds-5': '20px',
        'wds-6': '24px',
        'wds-8': '32px',
        'wds-10': '40px',
        'wds-12': '48px',
        'wds-16': '64px',
      },

      borderRadius: {
        'wds-none': 'var(--wds-radius-none)',
        'wds-sm': 'var(--wds-radius-sm)',
        'wds-md': 'var(--wds-radius-md)',
        'wds-lg': 'var(--wds-radius-lg)',
        'wds-full': 'var(--wds-radius-full)',
      },

      boxShadow: {
        'wds-sm': 'var(--wds-shadow-sm)',
        'wds-md': 'var(--wds-shadow-md)',
        'wds-lg': 'var(--wds-shadow-lg)',
        'wds-drawer': 'var(--wds-shadow-drawer)',
        'wds-sheen': 'var(--wds-sheen-inset)',
        'wds-ring': '0 0 0 3px var(--wds-ring)',
      },

      keyframes: {
        'wds-skeleton': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'wds-pour-cup': {
          '0%, 100%': { transform: 'rotate(0deg) translateY(0px)' },
          '15%': { transform: 'rotate(-34deg) translateY(-1px)' },
          '65%': { transform: 'rotate(-34deg) translateY(-1px)' },
          '85%': { transform: 'rotate(0deg) translateY(0px)' },
        },
        'wds-pour-fill': {
          '0%, 8%': { clipPath: 'inset(0 100% 0 0)' },
          '85%': { clipPath: 'inset(0 0% 0 0)' },
          '92%': { clipPath: 'inset(0 -1.5% 0 0)' },
          '100%': { clipPath: 'inset(0 0% 0 0)' },
        },
        'wds-pour-bead': {
          '0%, 8%, 88%, 100%': { opacity: '0', transform: 'translateY(-2px)' },
          '14%': { opacity: '0.4', transform: 'translateY(0px)' },
          '60%': { opacity: '0.4', transform: 'translateY(2px)' },
          '68%': { opacity: '0', transform: 'translateY(4px)' },
        },
        'wds-steam-1': {
          '0%': { opacity: '0', transform: 'translateY(0px) scaleY(1)' },
          '30%': { opacity: '0.32' },
          '100%': { opacity: '0', transform: 'translateY(-7px) scaleY(1.15)' },
        },
        'wds-steam-2': {
          '0%': { opacity: '0', transform: 'translateY(0px) scaleY(1)' },
          '35%': { opacity: '0.28' },
          '100%': { opacity: '0', transform: 'translateY(-6px) scaleY(1.12)' },
        },
      },
      animation: {
        'wds-skeleton': 'wds-skeleton 1.4s ease-in-out infinite',
        'wds-pour-cup': 'wds-pour-cup 1.2s cubic-bezier(0.33, 1, 0.68, 1) infinite',
        'wds-pour-fill': 'wds-pour-fill 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'wds-pour-bead': 'wds-pour-bead 1.2s ease-in-out infinite',
        'wds-steam-1': 'wds-steam-1 1.9s ease-in-out infinite',
        'wds-steam-2': 'wds-steam-2 1.9s ease-in-out infinite 0.55s',
      },
    },
  },
};

export default wdsPreset;
