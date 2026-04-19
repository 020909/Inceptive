import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          // White bg, cool gray border, Interaction Blue focus — no shadow
          "h-9 w-full min-w-0 rounded-[8px] border border-[#d9d9dd] bg-white px-3 py-1.5 text-sm text-black transition-colors outline-none",
          "placeholder:text-[#93939f]",
          "focus-visible:border-[#1863dc] focus-visible:outline-none focus-visible:ring-0",
          "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-black",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#f2f2f2] disabled:opacity-50",
          "aria-invalid:border-[#c0392b]",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
