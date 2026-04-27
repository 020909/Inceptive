import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Inceptive OS v3.0 Button System
 * - 8px radius (radius-sm)
 * - No shadows
 * - Sora/DM Sans typography
 * - Uppercase, tracked labels
 */

const buttonVariants = cva(
  // Base: inline-flex, no shadows, uppercase tracked text
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3437] focus-visible:ring-offset-2 focus-visible:ring-offset-[#040506] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: White fill, dark text, 8px radius
        default:
          "bg-white text-[#070A0B] hover:bg-[#D0D5D9]",
        // Ghost: Transparent with border
        ghost:
          "border border-[#2F3437] bg-transparent text-[#F0F2F3] hover:bg-[#181C1E]",
        // Outline: Alias for ghost (compatibility)
        outline:
          "border border-[#2F3437] bg-transparent text-[#F0F2F3] hover:bg-[#181C1E]",
        // Secondary: Elevated surface
        secondary:
          "bg-[#181C1E] text-[#F0F2F3] hover:bg-[#202527] border border-[#232829]",
        // Destructive: Red signal
        destructive:
          "bg-[#220B0B] text-[#DC2626] border border-[#DC2626] hover:bg-[#220B0B]/80",
        // Link: Text only
        link:
          "text-[#8A9AA8] underline-offset-4 hover:underline hover:text-[#F0F2F3]",
      },
size: {
      // Standard: 8px radius, uppercase 12px
      default:
        "h-9 px-5 text-[12px] font-bold tracking-[0.12em] uppercase rounded-[8px]",
      // Small: Compact
      sm:
        "h-8 px-4 text-[11px] font-bold tracking-[0.12em] uppercase rounded-[8px]",
      // Large: Prominent
      lg:
        "h-11 px-6 text-[12px] font-bold tracking-[0.12em] uppercase rounded-[8px]",
      // Icon: Square-ish
      icon:
        "h-9 w-9 rounded-[8px]",
      // Icon Small: Compact square
      "icon-sm":
        "h-8 w-8 rounded-[8px]",
    },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
