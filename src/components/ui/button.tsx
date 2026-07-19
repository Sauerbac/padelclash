import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Fight Night buttons: default = Anton uppercase on primary red, outline =
// gold text on a 1px border, ghost = muted letter-spaced text, destructive =
// ember-red outline (never filled). Sharp corners come from --radius: 0.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap uppercase transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-display text-lg tracking-[1px] text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-border text-[13px] font-semibold tracking-[2px] text-accent hover:bg-secondary",
        secondary:
          "bg-secondary text-[13px] font-semibold tracking-[2px] text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-[13px] font-semibold tracking-[2px] text-muted-foreground hover:text-foreground",
        destructive:
          "border border-destructive-border font-mono text-xs font-semibold text-destructive hover:bg-destructive/10",
        chip: "border font-mono text-[11px] font-semibold text-muted-foreground hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-7 gap-1 px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-14 px-6 text-xl",
        icon: "size-11",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
