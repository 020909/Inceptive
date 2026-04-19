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
          "h-9 w-full min-w-0 rounded-[8px] px-3 py-1.5 text-sm transition-colors outline-none",
          "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-[var(--destructive)]",
          className
        )}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--fg-primary)",
        } as React.CSSProperties}
        onFocus={e => {
          e.currentTarget.style.borderColor = "var(--accent)";
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = "var(--border-default)";
        }}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
