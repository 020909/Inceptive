"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — DM Sans, no decoration; 2px Interaction Blue focus outline
  "group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding text-sm whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1863dc] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Dark solid — primary CTA, pill shape
        default:
          "rounded-full border-transparent bg-[var(--fg-primary)] text-[var(--bg-elevated)] hover:opacity-85 active:opacity-75",
        // Ghost / transparent
        ghost:
          "rounded-full border-transparent bg-transparent text-[var(--fg-secondary)] hover:text-[var(--accent)] hover:bg-[var(--nav-hover-bg)] active:opacity-65",
        // Outlined
        outline:
          "rounded-full border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:opacity-80",
        // Secondary — warm sand / overlay surface
        secondary:
          "rounded-full border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--fg-charcoal)] hover:bg-[var(--border-default)] active:opacity-80",
        // Destructive
        destructive:
          "rounded-full border-[var(--destructive-soft)] bg-[var(--destructive-soft)] text-[var(--destructive)] hover:opacity-80 active:opacity-70",
        // Link
        link: "rounded-none border-transparent px-0 text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-5 font-[500] text-[14px]",
        xs: "h-6 gap-1 rounded-full px-3 text-xs",
        sm: "h-7 gap-1 rounded-full px-4 text-[0.8rem]",
        lg: "h-11 gap-1.5 px-6 text-[15px]",
        icon: "size-9 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-full",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
