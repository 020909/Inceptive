import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[22px]", className)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base", className)}
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 400,
        letterSpacing: "-0.16px",
        color: "var(--fg-primary)",
      }}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm", className)}
      style={{ fontFamily: "var(--font-body)", color: "var(--fg-muted)" }}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
