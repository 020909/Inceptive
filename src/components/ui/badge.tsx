import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Inceptive OS v3.0 Badge/Pill System
 * - 9999px radius (full pill)
 * - Semantic colors with dark backgrounds
 * - Uppercase, tracked labels (label-caps style)
 * - 3px 10px padding
 */

const badgeVariants = cva(
  // Base: inline-flex, pill shape, uppercase tracked
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150",
  {
    variants: {
      variant: {
        // Positive: Green signal
        positive:
          "text-[#16A34A] bg-[#0B2218] border border-[#16A34A]/30",
        // Negative: Red signal
        negative:
          "text-[#DC2626] bg-[#220B0B] border border-[#DC2626]/30",
        // Warning: Amber signal
        warning:
          "text-[#D97706] bg-[#231708] border border-[#D97706]/30",
        // Info: Blue signal
        info:
          "text-[#0EA5E9] bg-[#071520] border border-[#0EA5E9]/30",
        // Default: Muted
        default:
          "text-[#8A9AA8] bg-[#111416] border border-[#232829]",
        // Outline: Transparent bg
        outline:
          "text-[#F0F2F3] bg-transparent border border-[#2F3437]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
