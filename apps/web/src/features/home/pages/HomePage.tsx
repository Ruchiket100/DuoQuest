import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import ProgressBar from "@/components/ui/ProgressBar.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import Badge from "@/components/ui/Badge.tsx";
import Modal from "@/components/ui/Modal.tsx";
import Input from "@/components/ui/Input.tsx";
import { Flame, CheckCircle, Clock, Plus, Zap } from "lucide-react";
import type { DuoOverview, Task } from "@duoquest/shared";
import DuoHeatmap from "../components/DuoHeatmap.tsx";
import MoodCheckIn from "../components/MoodCheckIn.tsx";
import { triggerConfetti } from "@/lib/confetti.ts";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { cn } from "@/lib/utils.ts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function HomePage() {
  const { user } = useAuthStore();
  const { setActiveDuoSpace } = useDuoSpaceStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Modal controls
  const [isTaskModalOpen, setIsTaskModalOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState<"personal" | "shared">("personal");

  const [isNudgeModalOpen, setIsNudgeModalOpen] = React.useState(false);
  const [isShaking, setIsShaking] = React.useState(false);
  const [quote, setQuote] = React.useState<{ text: string; author: string } | null>(null);

  React.useEffect(() => {
    const fallbackQuotes = [
      { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
      { text: "Consistency is the key to unlocking your full potential.", author: "Unknown" },
      { text: "Great things in business are never done by one person; they're done by a team of people.", author: "Steve Jobs" },
      { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
      { text: "Do not wait; the time will never be 'just right.'", author: "Napoleon Hill" }
    ];

    const fetchQuote = async () => {
      try {
        const res = await fetch("https://dummyjson.com/quotes/random");
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        if (data && data.quote) {
          setQuote({ text: data.quote, author: data.author || "Unknown" });
          return;
        }
      } catch (err) {
        console.warn("Failed to fetch random quote, using fallback:", err);
      }
      const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
      setQuote(fallbackQuotes[randomIndex]);
    };

    fetchQuote();
  }, []);

  // Fetch memberships first to discover active Duo Space
  const { data: profileData, isLoading: isProfileLoading } = useQuery<any>({
    queryKey: ["userProfile"],
    queryFn: () => api.get("/api/users/me"),
  });

  const memberSpace = profileData?.duoMemberships?.[0]?.duoSpace;
  const duoSpaceId = memberSpace?.id;

  React.useEffect(() => {
    if (memberSpace) {
      setActiveDuoSpace(memberSpace);
    }
  }, [memberSpace, setActiveDuoSpace]);

  // Setup Realtime Subscription for Nudges/Updates
  React.useEffect(() => {
    if (!duoSpaceId || !supabase) return;

    let channel: RealtimeChannel;
    try {
      channel = supabase
        .channel(`duo-chat:${duoSpaceId}`)
        .on("broadcast", { event: "new_message" }, (payload) => {
          const newMessage = payload.payload;
          if (newMessage && newMessage.senderId !== user?.id) {
            // Trigger shake animation and toast if it is a nudge
            if (newMessage.type === "nudge") {
              setIsShaking(true);
              setTimeout(() => setIsShaking(false), 800);
              addToast.addToast(`👋 Nudge: "${newMessage.content}"`, "info");
            }
            // Invalidate queries so stats and notifications update
            queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
            queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
          }
        })
        .subscribe();
    } catch (err) {
      console.error("Supabase Realtime subscription error on HomePage", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [duoSpaceId, queryClient, user?.id, addToast]);

  // Fetch overview aggregates
  const { data: overview, isLoading: isOverviewLoading } = useQuery<DuoOverview>({
    queryKey: ["duoOverview", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/overview`),
    enabled: !!duoSpaceId,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["duoTasks", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/tasks`),
    enabled: !!duoSpaceId,
  });

  // Task creation mutation
  const createTaskMutation = useMutation({
    mutationFn: (newTask: { title: string; type: "personal" | "shared" }) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/tasks`, newTask),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duoTasks", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsTaskModalOpen(false);
      setTaskTitle("");
      addToast.addToast("Task created!", "success");
    },
    onError: (err: any) => {
      addToast.addToast(err.message || "Failed to create task", "error");
    },
  });

  // Toggle completion mutation (OPTIMISTIC)
  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/api/tasks/${taskId}/complete`, {}),
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["duoTasks", duoSpaceId] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(["duoTasks", duoSpaceId]);

      // Trigger confetti if task is being completed
      const task = previousTasks?.find((t) => t.id === taskId);
      if (task && !task.completed) {
        triggerConfetti();
      }

      // Optimistically toggle the task
      queryClient.setQueryData<Task[]>(["duoTasks", duoSpaceId], (old) =>
        old?.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        )
      );

      return { previousTasks };
    },
    onError: (_err, _taskId, context) => {
      // Roll back to the previous value on error
      if (context?.previousTasks) {
        queryClient.setQueryData(["duoTasks", duoSpaceId], context.previousTasks);
      }
      addToast.addToast("Failed to update task", "error");
    },
    onSettled: () => {
      // Always refetch after error or success to get the true server state
      queryClient.invalidateQueries({ queryKey: ["duoTasks", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  // Send Nudge mutation
  const sendNudgeMutation = useMutation({
    mutationFn: (nudgeText: string) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/messages`, {
        content: nudgeText,
        type: "nudge",
      }),
    onSuccess: () => {
      setIsNudgeModalOpen(false);
      addToast.addToast("Nudge sent to partner!", "success");
    },
  });

  if (isProfileLoading || isOverviewLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 bg-black-elevated rounded-card" />
        <div className="h-32 bg-black-elevated rounded-card" />
        <div className="h-48 bg-black-elevated rounded-card" />
      </div>
    );
  }

  // Handle case where user is not in a Duo Space yet
  if (!duoSpaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-6">
        <div className="text-6xl">🤝</div>
        <div className="space-y-2">
          <h2 className="font-display font-extrabold text-2xl text-white-off">No Active Duo Space</h2>
          <p className="text-white-muted text-sm max-w-sm">
            DuoQuest works best when paired with an accountability partner. Customize your space or join your friend's space to get started.
          </p>
        </div>
        <Button onClick={() => navigate("/onboarding")}>Set Up Space</Button>
      </div>
    );
  }

  const currentDuo = overview?.duoSpace;
  const streakInfo = overview?.streak;
  const progressList = overview?.todayProgress || [];
  const activityList = overview?.recentActivity || [];

  return (
    <div className={cn("space-y-6 pb-20", isShaking && "animate-shake")}>
      {/* ─── Daily Quote Card ─── */}
      {quote && (
        <Card className="border border-white/5 bg-white/[0.02] p-4 text-left relative overflow-hidden flex items-start gap-3">
          <div className="text-2xl text-lime-soft shrink-0 select-none font-display">“</div>
          <div className="space-y-1 flex-1">
            <p className="text-xs font-medium italic text-white-off leading-relaxed">
              {quote.text}
            </p>
            <p className="text-[10px] font-bold text-white-muted uppercase tracking-wider text-right">
              — {quote.author}
            </p>
          </div>
        </Card>
      )}

      {/* ─── Hero Card ─── */}
      {currentDuo && (
        <Card className="relative overflow-hidden border border-white/5 bg-gradient-to-br from-black-card via-black-card to-purple-deep/10">
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-lime-soft uppercase tracking-widest">Duo Space</span>
              <h2 className="font-display font-extrabold text-2xl text-white-off">{currentDuo.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-white-muted font-medium pt-1">
                <Zap className="w-3.5 h-3.5 fill-purple-warm text-purple-warm" />
                <span>Level {currentDuo.level}</span>
                <span className="h-1 w-1 rounded-full bg-white/20 mx-1" />
                <span>{currentDuo.totalXp} XP accrued</span>
              </div>
            </div>

            {/* Streak flame */}
            <div className="flex flex-col items-center justify-center bg-black-elevated/80 border border-white/10 px-3 py-2 rounded-card min-w-[70px]">
              <Flame className="w-6 h-6 text-gold fill-gold animate-bounce" />
              <span className="text-lg font-display font-extrabold text-white-off">
                {streakInfo?.currentDays || 0}
              </span>
              <span className="text-[9px] uppercase font-bold text-white-muted tracking-wider">Days</span>
            </div>
          </div>

          <div className="mt-6">
            <ProgressBar value={currentDuo.level * 8 % 100} color="lime" showText />
          </div>
        </Card>
      )}

      {/* ─── Invite Partner Card ─── */}
      {overview?.members && overview.members.length < 2 && (
        <Card className="border border-dashed border-purple-warm/30 bg-purple-deep/5 p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
          <div className="space-y-1">
            <h4 className="font-display font-bold text-base text-white-off">👋 Waiting for your partner</h4>
            <p className="text-xs text-white-muted">
              DuoQuest is a 2-player game! Send this invite code to your buddy so they can join this space:
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="font-mono font-bold text-lg text-lime-soft bg-black-elevated px-3 py-1.5 rounded-button border border-white/5 tracking-wider select-text">
                {currentDuo?.inviteCode}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(currentDuo?.inviteCode || "");
                  addToast.addToast("Invite code copied!", "success");
                }}
              >
                Copy Code
              </Button>
            </div>
          </div>
          <div className="text-4xl shrink-0">🤝</div>
        </Card>
      )}

      {/* ─── Mood Check-In ─── */}
      <MoodCheckIn />

      {/* ─── Task List ─── */}
      <Card className="space-y-4 border border-white/5 text-left">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-white-off">Today's Tasks</h3>
          <Button size="sm" className="flex items-center gap-1" onClick={() => setIsTaskModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="h-20 bg-black-elevated/30 border border-dashed border-white/10 rounded-button flex items-center justify-center text-xs text-white-muted">
            No tasks set for today yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTaskMutation.mutate(task.id)}
                    className="text-white-muted hover:text-lime-soft transition-colors cursor-pointer"
                  >
                    <CheckCircle
                      className={`w-5 h-5 ${
                        task.completed ? "text-lime-soft fill-lime-soft/10" : "text-white-muted/40"
                      }`}
                    />
                  </button>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${task.completed ? "line-through text-white-muted" : "text-white-off"}`}>
                      {task.title}
                    </p>
                    <div className="flex gap-1.5 items-center mt-0.5 flex-wrap">
                      <Badge variant={task.type === "shared" ? "secondary" : "outline"}>
                        {task.type}
                      </Badge>
                      {task.recurring && (
                        <span className="text-[10px] text-purple-warm font-semibold flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {task.recurring}
                        </span>
                      )}
                      {(task as any).goal && (
                        <Badge variant="gold">
                          🎯 {(task as any).goal.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Avatar src={task.user?.avatarUrl} name={task.user?.username} size="sm" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── Today's Progress Section ─── */}
      <Card className="space-y-4 border border-white/5">
        <h3 className="font-display font-bold text-lg text-white-off text-left">Today's Progress</h3>
        <div className="space-y-3">
          {progressList.map((prog) => (
            <div key={prog.userId} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Avatar src={prog.avatarUrl} name={prog.username} size="sm" />
                  <span className={prog.userId === user?.id ? "text-white" : "text-white-muted"}>
                    {prog.username} {prog.userId === user?.id && "(You)"}
                  </span>
                </div>
                <span className="text-white-muted">
                  {prog.completedTasks}/{prog.totalTasks} tasks
                </span>
              </div>
              <ProgressBar
                value={prog.totalTasks > 0 ? (prog.completedTasks / prog.totalTasks) * 100 : 0}
                color={prog.userId === user?.id ? "lime" : "purple"}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Duo Heatmap Section ─── */}
      {overview && (
        <DuoHeatmap heatmap={overview.heatmap} members={overview.members} />
      )}

      {/* ─── Activity Feed ─── */}
      <Card className="space-y-4 border border-white/5 text-left">
        <h3 className="font-display font-bold text-lg text-white-off">Duo Feed</h3>
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
          {activityList.length === 0 ? (
            <span className="text-xs text-white-muted block">No activity logs recorded.</span>
          ) : (
            activityList.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs">
                <Avatar src={log.user?.avatarUrl} name={log.user?.username} size="sm" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="text-white-off">
                    <span className="font-bold text-lime-soft">@{log.user?.username}</span>{" "}
                    {log.action === "task_completed" && `completed "${log.metadata?.title}"`}
                    {log.action === "goal_created" && `created goal "${log.metadata?.goalTitle}"`}
                    {log.action === "goal_completed" && `completed goal "${log.metadata?.goalTitle}" 🎉`}
                    {log.action === "challenge_joined" && `joined the accountability space! 🤝`}
                  </p>
                  {log.xpEarned > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-lime-soft font-bold">
                      +{log.xpEarned} XP
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Quick Action FABs */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex gap-3 z-35">
        <Button variant="secondary" className="shadow-float" onClick={() => setIsNudgeModalOpen(true)}>
          👋 Nudge Partner
        </Button>
      </div>

      {/* ─── Create Task Modal ─── */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="New Task">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskTitle) return;
            createTaskMutation.mutate({ title: taskTitle, type: taskType });
          }}
          className="space-y-4"
        >
          <Input
            id="taskTitle"
            type="text"
            label="What needs to be done?"
            placeholder="e.g. Study System Design"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider">
              Task Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["personal", "shared"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTaskType(t)}
                  className={`py-2 px-3 rounded-button text-xs font-semibold border capitalize transition-all cursor-pointer ${
                    taskType === t
                      ? "bg-lime-soft/10 border-lime-soft text-white"
                      : "bg-black-elevated border-white/5 text-white-muted hover:border-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" isLoading={createTaskMutation.isPending}>
            Add Task
          </Button>
        </form>
      </Modal>

      {/* ─── Nudge Modal ─── */}
      <Modal isOpen={isNudgeModalOpen} onClose={() => setIsNudgeModalOpen(false)} title="Send a Nudge">
        <div className="space-y-3">
          <p className="text-xs text-white-muted text-left">Select a quick message to nudge your partner:</p>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {[
              "Need backup? 💪",
              "Let's finish today! 🚀",
              "Only a few tasks left! 🎯",
              "Don't break the streak! 🔥",
              "You got this! 💯",
              "Time to show up! ⏰",
            ].map((nudge) => (
              <button
                key={nudge}
                onClick={() => sendNudgeMutation.mutate(nudge)}
                className="py-2.5 px-4 bg-black-elevated border border-white/5 hover:border-purple-warm/40 hover:bg-black-card text-sm text-white-off text-left rounded-button cursor-pointer transition-all"
              >
                {nudge}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default HomePage;
