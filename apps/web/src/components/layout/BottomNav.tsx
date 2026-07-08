import { NavLink, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Target, MessageSquare, Trophy, Bell, User, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import api from "@/lib/api.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useAuthStore } from "@/stores/authStore.ts";
import type { JournalEntry } from "@duoquest/shared";

export function BottomNav() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const { user } = useAuthStore();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["unreadCount"],
    queryFn: () => api.get("/api/notifications/unread-count"),
    refetchInterval: 30_000, // Poll every 30 seconds
  });

  const { data: journalEntries = [] } = useQuery<JournalEntry[]>({
    queryKey: ["journalEntries", activeDuoSpace?.id],
    queryFn: () => api.get(`/api/duo-spaces/${activeDuoSpace?.id}/journal`),
    enabled: !!activeDuoSpace?.id,
    refetchInterval: 30_000, // Poll every 30 seconds
  });

  const unreadCount = unreadData?.count || 0;
  const lastViewedJournal = localStorage.getItem(`last_viewed_journal_time:${activeDuoSpace?.id}`) || "1970-01-01T00:00:00.000Z";
  const unreadJournalCount = journalEntries.filter(
    (e) => e.type === "shared" && e.userId !== user?.id && e.createdAt > lastViewedJournal
  ).length;

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/goals", icon: Target, label: "Goals" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    { to: "/challenges", icon: Trophy, label: "Challenges" },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  const location = useLocation();

  const floatingNavs = location.pathname !== "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 z-40 glass-nav flex items-center justify-around px-2 pb-safe">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 gap-1 w-14 hover:text-white cursor-pointer relative",
              isActive
                ? "text-lime-soft font-bold scale-105"
                : "text-white-muted"
            )
          }
        >
          <Icon className="w-5 h-5 transition-transform duration-200" />
          <span className="text-[10px] tracking-wide select-none">{label}</span>
        </NavLink>
      ))}

      {/* Journal - floating FAB above nav on the right */}
      <NavLink
        to="/journal"
        hidden={floatingNavs}
        className={({ isActive }) =>
          cn(
            "fixed bottom-32 right-6 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-float z-45 border cursor-pointer",
            isActive
              ? "bg-purple-warm border-purple-deep text-white"
              : "bg-black-elevated border-white/10 text-white-muted hover:text-white"
          )
        }
      >
        <BookOpen className="w-5 h-5" />
        {unreadJournalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-accent text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadJournalCount > 9 ? "9+" : unreadJournalCount}
          </span>
        )}
      </NavLink>

      {/* Notification bell - floating FAB above nav */}
      <NavLink
        to="/notifications"
        hidden={floatingNavs}
        className={({ isActive }) =>
          cn(
            "fixed bottom-20 right-6 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-float z-45 border cursor-pointer",
            isActive
              ? "bg-purple-warm border-purple-deep text-white"
              : "bg-black-elevated border-white/10 text-white-muted hover:text-white"
          )
        }
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-accent text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </NavLink>
    </nav>
  );
}
export default BottomNav;
