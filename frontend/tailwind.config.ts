import type { Config } from 'tailwindcss';
import wdsPreset from './tailwind.wds.preset';

const config: Config = {
  // `features/**` added 2026-09-15 — the frontend feature-module amendment
  // (FEATURE_REDO_PLAYBOOK.md §9) moved redone-feature code there, but this
  // glob predates that and was never updated: any class used only inside
  // `features/` (never duplicated in `app/`/`components/`) was silently
  // never generated, with no build error. Inventory is the first feature to
  // hit this; every later feature would have hit it too.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  // The `wds-*` scale (new design system, used by components/ui2/) lives in its
  // own preset so it never collides with the legacy warm theme below. When
  // components/ui/ is retired, fold the preset in here and drop the prefix.
  presets: [wdsPreset as Config],
  theme: {
    extend: {
      colors: {
        espresso: {
          DEFAULT: '#2C1810',
          light: '#4A2C1A',
        },
        crema: '#F5F0E8',
        parchment: '#EDE7DC',
        amber: {
          DEFAULT: '#C4862A',
          light: '#F0C97A',
        },
        stone: {
          100: '#F4F2EF',
          200: '#E8E5E1',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          900: '#1C1917',
        },
        status: {
          pending: {
            bg: '#FDF3DC',
            text: '#92650A',
            border: '#F0D080',
          },
          inprogress: {
            bg: '#FEF0E0',
            text: '#A04F0A',
            border: '#F5B87A',
          },
          ready: {
            bg: '#EDFAF1',
            text: '#1A6B3C',
            border: '#86EFAC',
          },
          closed: {
            bg: '#F4F4F5',
            text: '#71717A',
            border: '#D4D4D8',
          },
          cancelled: {
            bg: '#FDF2F0',
            text: '#9B3A2A',
            border: '#F5A898',
          },
        },
        danger: {
          DEFAULT: '#991B1B',
          bg: '#FEF2F2',
          border: '#FCA5A5',
        },
        success: {
          DEFAULT: '#1A6B3C',
          bg: '#EDFAF1',
          border: '#86EFAC',
        },
        warning: {
          DEFAULT: '#92400E',
          bg: '#FFFBEB',
          border: '#FCD34D',
        },
        // Excel-style data surfaces (Sheet / ExcelTable). Values lifted from the
        // hand-built payroll sheet so existing visuals are preserved exactly.
        sheet: {
          grid: '#D8D4D0',
          'grid-dense': '#D0D0D0',
          header: '#F0F0F0',
          toolbar: '#E0E0E0',
          statusbar: '#217346',
          zebra: '#F6F5F4',
          'zebra-dense': '#F9F9F9',
          rownum: '#F0F0F0',
          'rownum-even': '#EBEBEB',
          hover: '#EEF3FA',
          subrow: '#FBFAF9',
          expanded: '#EAF1F8',
          totals: '#DCE6F1',
          locked: '#F5F5F5',
          selection: '#DBEAFE',
          'selection-ring': '#60A5FA',
          active: '#2563EB',
          negative: '#A31515',
          'dot-pending': '#F59E0B',
          'dot-error': '#EF4444',
          'dot-info': '#3B82F6',
          band: {
            navy: '#2E5984',
            green: '#1F6E43',
            red: '#A31515',
            purple: '#5B2D8E',
            teal: '#1A5276',
            gray: '#78716C',
          },
          // Column-group cell washes (soft = odd rows, base = even rows)
          tint: {
            green: '#EAF4E6',
            'green-soft': '#F0F7EE',
            red: '#FAE8E6',
            'red-soft': '#FDF0EE',
            purple: '#EDE6F5',
            'purple-soft': '#F3EEFA',
            'red-strong': '#FDE8E8',
            'green-strong': '#E6F3E8',
          },
        },
        // Back-office canvas (hybrid direction: warm floor, clean office).
        office: {
          canvas: '#FAFAFA',
          ink: '#1A0A00',
        },
      },
      fontFamily: {
        // next/font registers hashed family names; the CSS variables are the
        // only reliable way to reference the loaded webfonts.
        display: ['var(--font-display)', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        sheet: ['Calibri', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-md': ['1.75rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.35' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.4' }],
        'body-lg': ['1rem', { lineHeight: '1.6' }],
        'body-md': ['0.9375rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'label-md': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'label-sm': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        // Excel-style data surfaces (px-locked; these grids mimic spreadsheet density).
        // Sized for long entry sessions on desktop — real Excel defaults to ~14.7px.
        'sheet-base': ['13.5px', { lineHeight: '1.4' }],
        'sheet-cell': ['13px', { lineHeight: '1.35' }],
        'sheet-header': ['11.5px', { lineHeight: '1.3' }],
        'sheet-band': ['11px', { lineHeight: '1.2', letterSpacing: '0.06em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(44, 24, 16, 0.06), 0 1px 2px rgba(44, 24, 16, 0.04)',
        md: '0 4px 6px rgba(44, 24, 16, 0.07), 0 2px 4px rgba(44, 24, 16, 0.04)',
        lg: '0 10px 15px rgba(44, 24, 16, 0.08), 0 4px 6px rgba(44, 24, 16, 0.04)',
        xl: '0 20px 25px rgba(44, 24, 16, 0.10), 0 10px 10px rgba(44, 24, 16, 0.04)',
        focus: '0 0 0 3px rgba(196, 134, 42, 0.35)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        slower: '600ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
        decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-top': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'fade-up': 'fade-up 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        'slide-in-top': 'slide-in-top 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        'slide-up': 'slide-up 400ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
