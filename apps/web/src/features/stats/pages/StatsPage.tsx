import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import api from "@/lib/api.ts";
import Card from "@/components/ui/Card.tsx";
import DuoHeatmap from "../../home/components/DuoHeatmap.tsx";
import { BarChart3, Users, Sparkles, Crown, Zap, Trophy } from "lucide-react";
import Avatar from "@/components/ui/Avatar.tsx";
import Badge from "@/components/ui/Badge.tsx";
import type { DuoOverview } from "@duoquest/shared";

export function StatsPage() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const duoSpaceId = activeDuoSpace?.id;

  // Fetch overview aggregates (reuses home cache query)
  const { data: overview, isLoading } = useQuery<DuoOverview>({
    queryKey: ["duoOverview", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/overview`),
    enabled: !!duoSpaceId,
  });

  // Calculate dynamic stats
  const stats = React.useMemo(() => {
    if (!overview?.heatmap) {
      return { consistencyScore: 0, syncScore: 0 };
    }

    const heatmap = overview.heatmap;
    const dates = Object.keys(heatmap);
    const activeDays = dates.filter((d) => heatmap[d].u1 || heatmap[d].u2).length;
    const syncedDays = dates.filter((d) => heatmap[d].u1 && heatmap[d].u2).length;

    // Consistency score = percentage of active days in last 12 weeks (84 days)
    const consistencyScore = Math.min(Math.round((activeDays / 84) * 100), 100);

    // Sync score = percentage of active days that were cooperative (both active)
    const syncScore = activeDays > 0 ? Math.round((syncedDays / activeDays) * 100) : 0;

    return { consistencyScore, syncScore };
  }, [overview?.heatmap]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-black-elevated rounded-card" />
        <div className="h-40 bg-black-elevated rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h1 className="font-display font-extrabold text-2xl text-white-off">Duo Analytics</h1>
        <p className="text-sm text-white-muted">GitHub-inspired contribution activity and metrics.</p>
      </div>

      {/* Grid of basic stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col gap-2 text-left">
          <div className="flex items-center gap-2 text-lime-soft">
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Consistency Score</span>
          </div>
          <span className="text-3xl font-display font-extrabold">{stats.consistencyScore}%</span>
          <span className="text-[10px] text-white-muted">Active days in last 12 weeks</span>
        </Card>

        <Card className="flex flex-col gap-2 text-left">
          <div className="flex items-center gap-2 text-purple-warm">
            <Users className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Sync Score</span>
          </div>
          <span className="text-3xl font-display font-extrabold">{stats.syncScore}%</span>
          <span className="text-[10px] text-white-muted">Ratio of tasks completed together</span>
        </Card>
      </div>

      {/* Weekly Duo Recap Card */}
      {overview?.weeklyRecap && (
        <Card className="relative overflow-hidden border border-white/5 bg-gradient-to-br from-black-card via-black-card to-lime-soft/5 text-left p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-lime-soft font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-lime-soft" />
                Weekly Duo Recap
              </div>
              <h3 className="font-display font-extrabold text-lg text-white-off">Last 7 Days Summary</h3>
            </div>
            {overview.weeklyRecap.weeklyMvp && (
              <Badge variant="gold" className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>Weekly MVP</span>
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[10px] text-white-muted uppercase tracking-wider font-semibold block">Combined XP</span>
              <span className="text-xl font-bold text-white-off flex items-center gap-1">
                <Zap className="w-4.5 h-4.5 text-lime-soft fill-lime-soft/10" />
                {overview.weeklyRecap.totalXpEarned} XP
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-white-muted uppercase tracking-wider font-semibold block">Tasks Completed</span>
              <span className="text-xl font-bold text-white-off flex items-center gap-1">
                <Trophy className="w-4.5 h-4.5 text-purple-warm" />
                {overview.weeklyRecap.totalTasksCompleted} completed
              </span>
            </div>
          </div>

          {/* MVP / Dream Team Display */}
          {overview.weeklyRecap.weeklyMvp && (
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-button flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {overview.weeklyRecap.weeklyMvp.tie ? (
                  <span className="text-xl flex-shrink-0">🤝</span>
                ) : (
                  <Avatar
                    src={overview.weeklyRecap.weeklyMvp.avatarUrl}
                    name={overview.weeklyRecap.weeklyMvp.username}
                    size="sm"
                  />
                )}
                <div>
                  <span className="text-[10px] text-white-muted font-bold block">Weekly Star</span>
                  <span className="text-xs font-semibold text-white-off">
                    {overview.weeklyRecap.weeklyMvp.tie
                      ? "Dream Team (Tied)"
                      : `@${overview.weeklyRecap.weeklyMvp.username}`}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-lime-soft font-bold bg-lime-soft/10 px-2 py-0.5 rounded-pill">
                +{overview.weeklyRecap.weeklyMvp.xpEarned || 0} XP
              </span>
            </div>
          )}

          {/* Motivational Message */}
          <p className="text-xs text-white-muted/80 leading-relaxed font-medium">
            {overview.weeklyRecap.totalXpEarned > 200
              ? "🔥 You both are absolutely crushing it! A week of peak accountability. Keep the consistency grid glowing!"
              : overview.weeklyRecap.totalXpEarned > 50
              ? "⚡ Good progress! Challenge each other to turn more rest days into synced green squares next week."
              : "🌱 A quiet week for the duo. Remember, consistency is built step by step. Tap the 'Nudge Partner' button to check in!"}
          </p>
        </Card>
      )}

      {/* Actual Heatmap Grid */}
      {overview && (
        <DuoHeatmap heatmap={overview.heatmap} members={overview.members} />
      )}
    </div>
  );
}

export default StatsPage;
