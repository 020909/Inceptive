import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Inceptive OS v3.0 Input System
 * - 8px radius (radius-sm)
 * - surface-elevated background (#181C1E)
 * - border-subtle resting, border-strong focused
 * - NO shadows
 * - Monospace for numeric values
 */

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const isNumeric = type === "number" || type === "currency";
    
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex w-full rounded-[8px] border px-3 text-[13px] transition-colors duration-150",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
          "placeholder:text-[#3D464D]",
          "focus-visible:outline-none focus-visible:border-[#8A9AA8]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Background and border
          "bg-[#181C1E] border-[#232829]",
          // Height based on type
          type === "search" ? "h-10" : "h-9",
          // Monospace for numbers
          isNumeric ? "font-mono tracking-[0.01em]" : "font-sans",
          className
        )}
        style={{
          fontFamily: isNumeric ? "var(--font-mono)" : "var(--font-body)",
          color: "#F0F2F3",
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
