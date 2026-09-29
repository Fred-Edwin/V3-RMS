import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

/**
 * WDS Button — matches the Paper "Primitives" artboard.
 * Height 32 (sm 28, lg 36), radius 2. Espresso is the only filled color;
 * the primary carries a top-light sheen (--wds-sheen-inset).
 *
 * Press feedback: `scale(0.98)` on `:active`, 150ms ease-out (Milestone Six
 * §4.2 interaction baseline — applies to every button), skipped under
 * prefers-reduced-motion.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-wds-sm font-wds-sans text-wds-body-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-wds-gradient-primary text-wds-primary-fg shadow-wds-sheen hover:bg-wds-gradient-primary-hover',
        secondary:
          'border border-wds-border-strong bg-wds-gradient-secondary-btn text-wds-text hover:bg-wds-gradient-secondary-btn-hover active:bg-wds-gradient-secondary-btn-pressed',
        ghost: 'text-wds-neutral-700 hover:bg-wds-neutral-100',
        destructive: 'bg-wds-error-fg text-wds-primary-fg hover:opacity-90',
        link: 'text-wds-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-wds-4',
        sm: 'h-7 px-wds-3 text-wds-caption',
        lg: 'h-9 px-wds-5',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
