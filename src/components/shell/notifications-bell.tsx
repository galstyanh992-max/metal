"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchNotifications() {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const SEVERITY_ICONS: Record<string, any> = {
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
  CRITICAL: AlertCircle,
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "text-steel",
  WARNING: "text-status-yellow",
  ERROR: "text-status-orange",
  CRITICAL: "text-status-red",
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // poll every 30s
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-status-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-hairline">
          <div className="text-sm font-semibold">Ծանուցումներ</div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] gap-1"
              onClick={() => markAllRead.mutate()}
            >
              <Check className="size-3" /> Բոլորը կարդացված
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Նոր ծանուցումներ չկան
            </div>
          ) : (
            notifications.map((n: any) => {
              const Icon = SEVERITY_ICONS[n.severity] ?? Info;
              const color = SEVERITY_COLORS[n.severity] ?? "text-steel";
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 p-3 border-b border-hairline last:border-0 hover:bg-muted/40 cursor-pointer group"
                  onClick={() => markRead.mutate(n.id)}
                >
                  <Icon className={cn("size-4 shrink-0 mt-0.5", color)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-[10px] text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {new Date(n.createdAt).toLocaleString("hy-AM")}
                    </div>
                  </div>
                  <Check className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
