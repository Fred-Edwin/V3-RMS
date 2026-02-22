import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const customTextScale = [
  'display-2xl',
  'display-xl',
  'display-lg',
  'heading-xl',
  'heading-lg',
  'heading-md',
  'heading-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'label-lg',
  'label-md',
  'label-sm',
  'caption',
] as const;

// Treat custom text-* tokens as font-size utilities so text colors are not dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...customTextScale],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
