"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  onValueChange?: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function Tabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(defaultValue ?? "");
  const value = valueProp ?? uncontrolledValue;
  const setValue = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [onValueChange, valueProp]
  );

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  value,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  value: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const active = context.value === value;

  return (
    <button
      type="button"
      className={cn(
        "rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-[0_0_0_1px_rgba(232,230,220,0.68)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
        className
      )}
      onClick={() => context.onValueChange?.(value)}
      {...props}
    />
  );
}

function TabsContent({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }
  if (context.value !== value) return null;
  return <div className={cn("mt-4", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
