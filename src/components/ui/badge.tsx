import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-normal uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--fg-muted)]",
        outline: "border-[var(--border-default)] bg-transparent text-[var(--fg-muted)]",
        blue: "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]",
        green: "border-emerald-200 bg-emerald-50 text-emerald-700",
        gray: "border-[var(--border-light)] bg-[var(--bg-overlay)] text-[var(--fg-secondary)]",
        dark: "border-[var(--fg-primary)] bg-[var(--fg-primary)] text-[var(--bg-base)]",
      },
    },
    defaultVariants: { variant: "default" },
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
