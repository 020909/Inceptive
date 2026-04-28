import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inceptive OS v3.0 Card/Widget System
 * - 20px radius (radius-lg)
 * - surface-container background (#111416)
 * - border-subtle outline (#232829)
 * - NO shadows — tonal depth only
 * - 24px internal padding
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-container)] transition-[background-color,border-color,transform] duration-150 will-change-transform hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] hover:-translate-y-[1px]",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div 
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-6", className)} 
      {...props} 
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[15px] font-semibold leading-none tracking-tight", className)}
      style={{ fontFamily: "var(--font-display)" }}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-[13px] leading-relaxed text-[var(--muted-foreground)]", className)}
      style={{ fontFamily: "var(--font-body)" }}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div 
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)} 
      {...props} 
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ml-auto", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardAction };
