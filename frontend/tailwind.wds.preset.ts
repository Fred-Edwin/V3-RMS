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
          muted: 'var(--wds-text-muted)',
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
          fg: 'var(--wds-sidebar-fg)',
          'fg-active': 'var(--wds-sidebar-fg-active)',
          'fg-muted': 'var(--wds-sidebar-fg-muted)',
          divider: 'var(--wds-sidebar-divider)',
          marker: 'var(--wds-sidebar-marker)',
          'active-bg': 'var(--wds-sidebar-active-bg)',
          'badge-bg': 'var(--wds-sidebar-badge-bg)',
          'badge-fg': 'var(--wds-sidebar-badge-fg)',
        },
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
        'wds-body': ['14px', { lineHeight: '20px' }],
        'wds-body-sm': ['13px', { lineHeight: '19px' }],
        'wds-label': ['13px', { lineHeight: '16px', fontWeight: '500' }],
        'wds-caption': ['12px', { lineHeight: '16px' }],
        'wds-overline': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '600' }],
        'wds-mono': ['13px', { lineHeight: '18px' }],
        'wds-mono-sm': ['11px', { lineHeight: '14px' }],
      },

      /* 4px base — only the steps the system actually uses. */
      spacing: {
        'wds-0.5': '2px',
        'wds-1': '4px',
        'wds-2': '8px',
        'wds-3': '12px',
        'wds-4': '16px',
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
        'wds-sheen': 'var(--wds-sheen-inset)',
        'wds-ring': '0 0 0 3px var(--wds-ring)',
      },

      keyframes: {
        'wds-skeleton': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'wds-skeleton': 'wds-skeleton 1.4s ease-in-out infinite',
      },
    },
  },
};

export default wdsPreset;
