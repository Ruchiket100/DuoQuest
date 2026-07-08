import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import api from "@/lib/api.ts";
import { Bell, CheckCheck, Trophy, Zap, Heart, Award } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata: any;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  achievement: <Award className="w-5 h-5 text-gold" />,
  level_up: <Zap className="w-5 h-5 text-lime-soft" />,
  nudge: <Heart className="w-5 h-5 text-pink-400" />,
  challenge: <Trophy className="w-5 h-5 text-purple-warm" />,
  system: <Bell className="w-5 h-5 text-white-muted" />,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{
    items: Notification[];
    nextCursor: string | null;
  }>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/api/notifications"),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const notifications = data?.items || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            <Bell className="inline w-6 h-6 mr-2 text-purple-warm" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white-muted mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => markAllMutation.mutate()}
            isLoading={markAllMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Read All
          </Button>
        )}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-card bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="text-center py-12 space-y-3">
          <Bell className="w-10 h-10 text-white-muted mx-auto" />
          <p className="text-white-muted text-sm font-medium">
            All caught up!
          </p>
          <p className="text-white-muted/60 text-xs">
            You'll receive notifications for achievements, challenges, and more.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              className={cn(
                "w-full text-left rounded-card px-4 py-3.5 border transition-all duration-200 flex items-start gap-3",
                notification.read
                  ? "bg-white/[0.02] border-white/5 opacity-60"
                  : "bg-white/[0.04] border-white/10 hover:bg-white/[0.06]"
              )}
              onClick={() => {
                if (!notification.read) {
                  markOneMutation.mutate(notification.id);
                }
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {TYPE_ICONS[notification.type] || TYPE_ICONS.system}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "font-semibold text-sm truncate",
                      notification.read ? "text-white-muted" : "text-white"
                    )}
                  >
                    {notification.title}
                  </h3>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-lime-soft flex-shrink-0 animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-white-muted mt-0.5 line-clamp-2">
                  {notification.body}
                </p>
                <p className="text-[10px] text-white-muted/50 mt-1">
                  {formatRelative(notification.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
