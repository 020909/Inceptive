"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: DM Sans 14–16px weight 400–500, no decoration by default; focus = 2px solid Interaction Blue
  "group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding text-sm whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1863dc] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Dark solid — dark background, white text, pill shape
        default:
          "rounded-full border-transparent bg-black text-white hover:opacity-85 active:opacity-75",
        // Ghost / transparent — invisible until hover, text → Interaction Blue
        ghost:
          "rounded-full border-transparent bg-transparent text-black hover:text-[#1863dc] hover:opacity-80 active:opacity-65",
        // Outlined — bordered, text shifts to blue on hover
        outline:
          "rounded-full border-[#d9d9dd] bg-white text-black hover:border-[#1863dc] hover:text-[#1863dc] active:opacity-80",
        // Secondary — softest surface
        secondary:
          "rounded-full border-[#d9d9dd] bg-[#f2f2f2] text-black hover:bg-[#e5e7eb] hover:text-black active:opacity-80",
        // Destructive
        destructive:
          "rounded-full border-[rgba(192,57,43,0.18)] bg-[rgba(192,57,43,0.08)] text-[#c0392b] hover:bg-[rgba(192,57,43,0.14)] active:opacity-80",
        // Link — pure text
        link: "rounded-none border-transparent px-0 text-[#1863dc] underline-offset-4 hover:underline",
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
