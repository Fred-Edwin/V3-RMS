"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

/**
 * WDS Toggle — the segment of a segmented control (see toggle-group.tsx).
 * Paper draws only two states: selected (espresso-700 fill, primary-fg text)
 * and unselected (transparent, text-muted). No individual radius — segments
 * are visually joined by the ToggleGroup container's own border + radius.
 */
const toggleVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-wds-sans text-wds-caption font-normal text-wds-text-muted transition-colors hover:bg-wds-neutral-100 focus-visible:outline-none focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60 data-[state=on]:bg-wds-primary data-[state=on]:text-wds-primary-fg data-[state=on]:hover:bg-wds-primary [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
      },
      size: {
        default: "h-7 px-wds-3 py-wds-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
