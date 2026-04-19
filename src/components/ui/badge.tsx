import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base: pill shape, monospace uppercase per design system label spec
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-normal uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        // Default — bordered snow surface, muted slate text
        default: "border-[#d9d9dd] bg-[#fafafa] text-[#93939f]",
        // Outlined — transparent, just border
        outline: "border-[#d9d9dd] bg-transparent text-[#93939f]",
        // Interaction Blue accent
        blue: "border-[#1863dc]/20 bg-[#1863dc]/8 text-[#1863dc]",
        // Status: success green
        green: "border-emerald-200 bg-emerald-50 text-emerald-700",
        // Neutral gray
        gray: "border-[#e5e7eb] bg-[#f2f2f2] text-[#212121]",
        // Dark — inverted for light sections
        dark: "border-black bg-black text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
