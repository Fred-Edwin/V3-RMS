"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Minus } from "lucide-react"

import { cn } from "@/lib/cn"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-wds-2 has-[:disabled]:opacity-60",
      containerClassName
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-wds-2", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

// Each slot is its own bordered box (Paper draws 4 separate 40x44 boxes with
// an 8px gap, not a joined first/last-rounded group like shadcn's default) —
// confirmed via get_jsx on D61-0 (Sign sheet PIN entry).
const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]
  const filled = char != null && char !== ""

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-11 w-10 items-center justify-center rounded-wds-sm border text-wds-body font-wds-mono text-wds-text-ink transition-colors",
        filled
          ? "border-wds-neutral-950 bg-wds-neutral-950 text-wds-neutral-0"
          : "border-wds-border-strong bg-wds-surface",
        isActive && "z-10 shadow-wds-ring",
        className
      )}
      {...props}
    >
      {filled ? null : char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-wds-ink duration-1000" />
        </div>
      )}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
