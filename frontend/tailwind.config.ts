import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', 'serif'],
        sans: ['Jost', 'Futura', 'Century Gothic', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
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
      },
    },
  },
  plugins: [],
};

export default config;
