import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Fight Night badges. "you" is the gold ownership tag, "pending" the offline
// queue marker and "blocked" its dead end, "retired" a quiet outline,
// "win"/"loss" the rating-delta chips (name + signed delta in mono).
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap uppercase transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-primary px-2 py-0.5 text-xs font-bold tracking-[1px] text-primary-foreground",
        you: "bg-accent px-2 py-0.5 text-xs font-bold tracking-[2px] text-accent-foreground",
        pending:
          "bg-accent px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[1px] text-accent-foreground",
        blocked:
          "bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[1px] text-primary-foreground",
        retired:
          "border border-border px-2 py-1 text-[11px] font-bold tracking-[2px] text-muted-foreground",
        win: "border border-win px-1.5 py-0.5 font-mono text-[11px] font-semibold text-win",
        loss: "border border-destructive-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-destructive",
        outline:
          "border border-border px-2 py-0.5 text-xs font-semibold tracking-[1px] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
