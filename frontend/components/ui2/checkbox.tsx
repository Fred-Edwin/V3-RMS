"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/cn"

/**
 * Checkbox — Milestone Two "New purchase" catalog picker (2026-09-17).
 * Reference: Paper `X9J-0` catalog table checked/unchecked rows, `XDD-0`'s
 * `get_jsx` (`border-select-blue`, `size-4`, zero radius, 1.5px border,
 * `bg-surface` fill even when checked — the tick itself carries the color,
 * not a filled square). Deliberately square (no `rounded-sm`) and uses
 * `--wds-select-blue`, not the espresso/caramel palette — Paper's own
 * departure for this one control, confirmed via `get_tokens`.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid size-4 shrink-0 place-content-center border-[1.5px] border-wds-border-strong bg-wds-surface transition-colors focus-visible:outline-none focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-wds-select-blue",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-wds-select-blue")}
    >
      <Check className="size-2.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
