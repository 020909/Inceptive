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
      className={cn(
        "rounded-[20px] border transition-colors duration-150",
        className
      )}
      style={{
        background: "#111416",
        borderColor: "#232829",
      }}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div 
      className={cn("flex flex-col gap-1.5 p-6", className)} 
      {...props} 
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-[15px] font-semibold leading-none tracking-tight", className)}
      style={{
        fontFamily: "var(--font-display)",
        color: "#F0F2F3",
      }}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-[13px] leading-relaxed", className)}
      style={{
        fontFamily: "var(--font-body)",
        color: "#8A9AA8",
      }}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div 
      className={cn("flex items-center p-6 pt-0", className)} 
      {...props} 
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
