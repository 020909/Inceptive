"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CircleAlert, CircleCheckBig, Info, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  message: string | null;
  type: "info" | "success" | "warning" | "error";
  link: string | null;
  read: boolean;
  created_at: string;
};

function iconForType(type: NotificationRow["type"]) {
  if (type === "success") return CircleCheckBig;
  if (type === "warning") return TriangleAlert;
  if (type === "error") return CircleAlert;
  return Info;
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unread = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    let mounted = true;
    const supabase = createClient();

    const loadNotifications = async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const json = await response.json().catch(() => ({ notifications: [] }));
      if (!mounted) return;
      setNotifications((json.notifications ?? []) as NotificationRow[]);
    };

    void loadNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setNotifications((current) => [
            {
              id: row.id,
              title: row.title,
              message: row.message ?? null,
              type: row.type ?? "info",
              link: row.link ?? null,
              read: Boolean(row.read),
              created_at: row.created_at,
            },
            ...current,
          ].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function markRead(id: string, navigateTo?: string | null) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, read: true }),
    });

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );

    if (navigateTo) {
      router.push(navigateTo);
    } else {
      router.refresh();
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ all: true, read: true }),
    });

    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-surface)]"
            aria-label="Notifications"
          />
        }
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--fg-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[360px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="px-0 py-0 text-sm font-medium text-[var(--fg-primary)]">
            Notifications
          </DropdownMenuLabel>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={notifications.length === 0}>
            <CheckCheck />
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--fg-muted)]">No notifications yet.</div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto p-2">
            {notifications.map((notification) => {
              const Icon = iconForType(notification.type);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "mb-1 flex items-start gap-3 rounded-2xl px-3 py-3",
                    notification.read ? "bg-[var(--bg-base)] text-[var(--fg-secondary)]" : "bg-white text-[var(--fg-primary)]"
                  )}
                  onClick={() => markRead(notification.id, notification.link)}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", notification.read ? "font-medium" : "font-semibold")}>
                      {notification.title}
                    </div>
                    {notification.message ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--fg-muted)]">
                        {notification.message}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--fg-muted)]">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
