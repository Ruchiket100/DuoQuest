import React from "react";
import Card from "@/components/ui/Card.tsx";
import { cn } from "@/lib/utils.ts";

interface DuoHeatmapProps {
  heatmap?: Record<string, { u1: boolean; u2: boolean }>;
  members?: { user: { username: string; displayName: string | null } }[];
}

/**
 * Format a Date as YYYY-MM-DD using UTC components.
 * The backend stores @db.Date as UTC midnight, so the keys from the
 * API are UTC-based (e.g. "2026-07-08"). We must generate the same
 * UTC-based keys on the frontend grid to match.
 */
function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DuoHeatmap({ heatmap = {}, members = [] }: DuoHeatmapProps) {
  // Generate date array for the last 12 weeks (84 days) in UTC
  const dates = React.useMemo(() => {
    const arr: Date[] = [];
    const now = new Date();

    // "today" in UTC
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayDate = new Date(todayUTC);
    
    // Find the Saturday at the end of the current week (UTC)
    const dayOfWeek = todayDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToSaturday = 6 - dayOfWeek;
    const endMs = todayUTC + daysToSaturday * 86400000;

    // Go back 83 days from that Saturday (which lands exactly on a Sunday, forming 12 full weeks)
    const alignedStartMs = endMs - 83 * 86400000;

    for (let i = 0; i < 84; i++) {
      arr.push(new Date(alignedStartMs + i * 86400000));
    }
    return arr;
  }, []);

  const u1Name = members[0]?.user.displayName || members[0]?.user.username || "Partner 1";
  const u2Name = members[1]?.user.displayName || members[1]?.user.username || "Partner 2";

  // Group dates into 12 columns of 7 days (weeks)
  const weeks = React.useMemo(() => {
    const grid = [];
    for (let i = 0; i < 12; i++) {
      grid.push(dates.slice(i * 7, (i + 1) * 7));
    }
    return grid;
  }, [dates]);

  // "now" for future check
  const nowMs = Date.now();

  return (
    <Card className="border border-white/5 space-y-4 text-left p-5">
      <div className="space-y-1">
        <h3 className="font-display font-bold text-base text-white-off">Duo Consistency Grid</h3>
        <p className="text-xs text-white-muted">
          Your combined daily actions. Achieve a gradient cell by completing tasks together!
        </p>
      </div>

      <div className="flex items-start gap-2 pb-2 mt-4">
        {/* Days of week labels */}
        <div className="flex flex-col justify-around h-[116px] text-[10px] text-white-muted pr-1 font-semibold select-none pt-1">
          <span>Sun</span>
          <span>Tue</span>
          <span>Thu</span>
          <span>Sat</span>
        </div>

        {/* Heatmap Grid */}
        <div className="flex gap-1.5">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1.5">
              {week.map((date) => {
                const dateStr = toDateKey(date);
                const dayData = heatmap[dateStr] || { u1: false, u2: false };
                const isFuture = date.getTime() > nowMs;

                // Compute color classes
                let bgClass = "bg-white/[0.02] border border-white/5";
                if (!isFuture) {
                  if (dayData.u1 && dayData.u2) {
                    bgClass = "bg-gradient-to-br from-lime-soft to-purple-warm shadow-[0_0_10px_rgba(193,240,89,0.3)]";
                  } else if (dayData.u1) {
                    bgClass = "bg-lime-soft shadow-[0_0_8px_rgba(193,240,89,0.15)]";
                  } else if (dayData.u2) {
                    bgClass = "bg-purple-warm shadow-[0_0_8px_rgba(139,92,246,0.15)]";
                  }
                }

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "w-3.5 h-3.5 rounded-[3px] transition-all duration-200 cursor-help relative group",
                      bgClass,
                      isFuture && "opacity-20 cursor-not-allowed"
                    )}
                  >
                    {/* Tooltip */}
                    {!isFuture && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black-elevated border border-white/10 text-white-off text-[10px] py-1 px-2 rounded-[6px] shadow-float z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap">
                        <span className="font-bold">{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <div className="mt-0.5 space-y-0.5 font-medium">
                          <div className="flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", dayData.u1 ? "bg-lime-soft" : "bg-white/10")} />
                            <span>{u1Name}: {dayData.u1 ? "Done" : "No Activity"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", dayData.u2 ? "bg-purple-warm" : "bg-white/10")} />
                            <span>{u2Name}: {dayData.u2 ? "Done" : "No Activity"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Grid Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-white/5 text-[10px] text-white-muted font-bold select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[3px] bg-white/[0.02] border border-white/5" />
          <span>Rest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[3px] bg-lime-soft" />
          <span>{u1Name} Active</span>
        </div>
        {members.length > 1 && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-[3px] bg-purple-warm" />
              <span>{u2Name} Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-[3px] bg-gradient-to-br from-lime-soft to-purple-warm" />
              <span>Duo Synced! 🔥</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
export default DuoHeatmap;
