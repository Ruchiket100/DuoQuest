import React from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import ProgressBar from "@/components/ui/ProgressBar.tsx";
import Badge from "@/components/ui/Badge.tsx";
import Input from "@/components/ui/Input.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import Modal from "@/components/ui/Modal.tsx";
import { ArrowLeft, CheckCircle, Trash2, Calendar, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Goal, Milestone, GoalNote, Task } from "@duoquest/shared";
import { triggerConfetti } from "@/lib/confetti.ts";

export function GoalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeDuoSpace } = useDuoSpaceStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();

  const [milestoneTitle, setMilestoneTitle] = React.useState("");
  const [noteContent, setNoteContent] = React.useState("");
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [scheduleType, setScheduleType] = React.useState<"days" | "date">("days");
  const [selectedDays, setSelectedDays] = React.useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [dueDateText, setDueDateText] = React.useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const duoSpaceId = activeDuoSpace?.id;

  // Fetch goal detail
  const { data: goal, isLoading } = useQuery<Goal & { milestones: Milestone[]; notes: GoalNote[]; tasks: (Task & { user: any })[] }>({
    queryKey: ["goalDetail", id],
    queryFn: () => api.get(`/api/goals/${id}`),
    enabled: !!id,
  });

  // Toggle milestone completion (optimistic)
  const toggleMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => api.patch(`/api/milestones/${milestoneId}`, {}),
    onMutate: async (milestoneId) => {
      await queryClient.cancelQueries({ queryKey: ["goalDetail", id] });
      const previous = queryClient.getQueryData<any>(["goalDetail", id]);
      
      const milestone = previous?.milestones?.find((m: any) => m.id === milestoneId);
      if (milestone && !milestone.completed) {
        triggerConfetti();
      }

      queryClient.setQueryData<any>(["goalDetail", id], (old: any) => ({
        ...old,
        milestones: old?.milestones?.map((m: any) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m
        ),
      }));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["goalDetail", id], context.previous);
      addToast.addToast("Failed to update milestone", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["goalDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      if (duoSpaceId) queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
    },
  });

  // Add Milestone mutation
  const addMilestoneMutation = useMutation({
    mutationFn: (title: string) =>
      api.post(`/api/goals/${id}/milestones`, { title, order: goal?.milestones?.length || 0 }),
    onSuccess: () => {
      setMilestoneTitle("");
      queryClient.invalidateQueries({ queryKey: ["goalDetail", id] });
    },
  });

  // Add task linked to this goal
  const addGoalTaskMutation = useMutation({
    mutationFn: (data: { title: string; daysOfWeek: string | null; dueDate: string | null }) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/tasks`, {
        title: data.title,
        type: "personal",
        recurring: data.daysOfWeek ? "weekly" : null,
        daysOfWeek: data.daysOfWeek,
        dueDate: data.dueDate || undefined,
        goalId: id,
      }),
    onSuccess: () => {
      setNewTaskTitle("");
      setDueDateText("");
      queryClient.invalidateQueries({ queryKey: ["goalDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["duoTasks", duoSpaceId] });
      addToast.addToast("Task added to goal! 🎯", "success");
    },
    onError: (err: any) => addToast.addToast(err.message || "Failed to create task", "error"),
  });

  // Toggle goal task completion (optimistic)
  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/api/tasks/${taskId}/complete`, {}),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["goalDetail", id] });
      const previous = queryClient.getQueryData<any>(["goalDetail", id]);
      
      const task = previous?.tasks?.find((t: any) => t.id === taskId);
      if (task && !task.completed) {
        triggerConfetti();
      }

      queryClient.setQueryData<any>(["goalDetail", id], (old: any) => ({
        ...old,
        tasks: old?.tasks?.map((t: any) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        ),
      }));
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(["goalDetail", id], context.previous);
      addToast.addToast("Failed to update task", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["goalDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["duoTasks", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/api/goals/${id}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ["goalDetail", id] });
    },
  });

  // Delete Goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: () => api.delete(`/api/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      addToast.addToast("Goal deleted", "info");
      navigate("/goals");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-black-elevated rounded-card" />
        <div className="h-48 bg-black-elevated rounded-card" />
      </div>
    );
  }

  if (!goal) return null;

  const goalTasks = goal.tasks || [];

  const getGoalColorTheme = (color: string | null, type: "personal" | "shared") => {
    const defaults = type === "shared" 
      ? { text: "text-purple-warm", border: "hover:border-purple-warm/30", bar: "purple" as const }
      : { text: "text-lime-soft", border: "hover:border-lime-soft/30", bar: "lime" as const };

    if (!color) return defaults;

    switch (color) {
      case "lime":
        return { text: "text-lime-soft", border: "hover:border-lime-soft/30", bar: "lime" as const };
      case "purple":
        return { text: "text-purple-warm", border: "hover:border-purple-warm/30", bar: "purple" as const };
      case "orange":
        return { text: "text-orange-500", border: "hover:border-orange-500/30", bar: "orange" as const };
      case "blue":
        return { text: "text-blue-400", border: "hover:border-blue-400/30", bar: "blue" as const };
      case "rose":
        return { text: "text-rose-400", border: "hover:border-rose-400/30", bar: "rose" as const };
      default:
        return defaults;
    }
  };

  const theme = getGoalColorTheme(goal.color, goal.type);

  return (
    <div className="space-y-6 pb-20">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/goals")}
          className="flex items-center gap-1.5 text-xs text-white-muted hover:text-white font-bold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to goals</span>
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="text-red-accent hover:bg-red-accent/10 flex items-center gap-1"
          onClick={() => setIsDeleteModalOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </Button>
      </div>

      {/* Goal Hero details */}
      <Card className={cn("border border-white/5 text-left p-0 overflow-hidden", theme.border)}>
        {goal.imageUrl && (
          <div className="w-full h-36 overflow-hidden relative">
            <img src={goal.imageUrl} alt={goal.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black-card to-transparent" />
          </div>
        )}
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={goal.type === "shared" ? "secondary" : "primary"}>
                {goal.type}
              </Badge>
              {goal.dueDate && (
                <span className="text-[10px] text-white-muted font-bold flex items-center gap-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(goal.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-3xl shrink-0">{goal.icon || "🎯"}</span>
              <h2 className="font-display font-extrabold text-2xl text-white-off">{goal.title}</h2>
            </div>
            {goal.description && <p className="text-sm text-white-muted pt-1">{goal.description}</p>}
          </div>

          <div className="pt-2">
            <ProgressBar value={goal.progress} color={theme.bar} showText />
          </div>
        </div>
      </Card>

      {/* ─── Goal Tasks ─── */}
      <Card className="border border-white/5 text-left space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-white-off flex items-center gap-2">
            <Target className="w-5 h-5 text-lime-soft" />
            Goal Tasks
          </h3>
          <span className="text-xs text-white-muted font-bold">
            {goalTasks.filter((t) => t.completed).length}/{goalTasks.length}
          </span>
        </div>

        {/* Add Task Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTaskTitle.trim()) return;
            
            const daysOfWeekValue = scheduleType === "days" ? selectedDays.join(",") : null;
            const dueDateValue = scheduleType === "date" && dueDateText ? dueDateText : null;

            addGoalTaskMutation.mutate({
              title: newTaskTitle.trim(),
              daysOfWeek: daysOfWeekValue,
              dueDate: dueDateValue,
            });
          }}
          className="space-y-4"
        >
          <div className="flex gap-2">
            <Input
              id="goalTaskTitle"
              type="text"
              placeholder="Add a task for this goal..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              className="py-2.5"
            />
            <Button type="submit" size="sm" className="shrink-0" isLoading={addGoalTaskMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Schedule/Due Selector */}
          <div className="space-y-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-button">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white-muted font-bold uppercase tracking-wider">Schedule Type</span>
              <div className="flex gap-1 bg-black-deep/50 p-0.5 rounded-card border border-white/5">
                <button
                  type="button"
                  onClick={() => setScheduleType("days")}
                  className={cn(
                    "px-3 py-1.5 rounded-button text-[10px] font-bold uppercase transition-all cursor-pointer",
                    scheduleType === "days"
                      ? "bg-lime-soft text-black-deep shadow"
                      : "text-white-muted hover:text-white"
                  )}
                >
                  Weekly Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType("date")}
                  className={cn(
                    "px-3 py-1.5 rounded-button text-[10px] font-bold uppercase transition-all cursor-pointer",
                    scheduleType === "date"
                      ? "bg-lime-soft text-black-deep shadow"
                      : "text-white-muted hover:text-white"
                  )}
                >
                  Specific Date
                </button>
              </div>
            </div>

            {scheduleType === "days" ? (
              <div className="space-y-2">
                <span className="text-[10px] text-white-muted font-semibold block text-left">Select days this task repeats:</span>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { key: "mon", label: "Mon" },
                    { key: "tue", label: "Tue" },
                    { key: "wed", label: "Wed" },
                    { key: "thu", label: "Thu" },
                    { key: "fri", label: "Fri" },
                    { key: "sat", label: "Sat" },
                    { key: "sun", label: "Sun" },
                  ].map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          setSelectedDays((prev) =>
                            prev.includes(day.key)
                              ? prev.filter((d) => d !== day.key)
                              : [...prev, day.key]
                          );
                        }}
                        className={cn(
                          "py-2 text-[10px] font-bold rounded-card border transition-all cursor-pointer",
                          isSelected
                            ? "bg-purple-warm border-purple-warm/50 text-white shadow-[0_0_8px_rgba(139,92,246,0.25)]"
                            : "bg-white/[0.02] border-white/5 text-white-muted hover:bg-white/5"
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-left">
                <label htmlFor="taskDueDate" className="text-[10px] text-white-muted font-semibold block">
                  Select deadline:
                </label>
                <input
                  id="taskDueDate"
                  type="date"
                  value={dueDateText}
                  onChange={(e) => setDueDateText(e.target.value)}
                  required={scheduleType === "date"}
                  className="w-full bg-black-deep/50 border border-white/5 rounded-button text-xs text-white-off p-2.5 select-text focus:border-lime-soft/40 transition-colors"
                />
              </div>
            )}
          </div>
        </form>

        {/* Task List */}
        {goalTasks.length === 0 ? (
          <p className="text-xs text-white-muted">No tasks linked to this goal yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {goalTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTaskMutation.mutate(task.id)}
                    className="text-white-muted hover:text-lime-soft transition-colors cursor-pointer"
                  >
                    <CheckCircle
                      className={cn(
                        "w-5 h-5",
                        task.completed ? "text-lime-soft fill-lime-soft/10" : "text-white-muted/40"
                      )}
                    />
                  </button>
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      task.completed ? "line-through text-white-muted" : "text-white-off"
                    )}>
                      {task.title}
                    </p>
                    <div className="flex gap-1.5 items-center mt-0.5 flex-wrap">
                      {task.daysOfWeek && (
                        <Badge variant="outline" className="text-[9px] lowercase font-bold">
                          📅 {task.daysOfWeek.split(",").join(" • ")}
                        </Badge>
                      )}
                      {task.dueDate && (
                        <Badge variant="outline" className="text-[9px] font-bold">
                          🎯 {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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

      {/* Milestones list */}
      <Card className="border border-white/5 text-left space-y-4">
        <h3 className="font-display font-bold text-lg text-white-off">Milestones</h3>

        {/* Add Milestone Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!milestoneTitle) return;
            addMilestoneMutation.mutate(milestoneTitle);
          }}
          className="flex gap-2"
        >
          <Input
            id="milestoneTitle"
            type="text"
            placeholder="Add a milestone target..."
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
            className="py-2.5"
          />
          <Button type="submit" size="sm" className="shrink-0">
            Add
          </Button>
        </form>

        {/* List */}
        {goal.milestones?.length === 0 ? (
          <p className="text-xs text-white-muted">No milestones created yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {goal.milestones?.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMilestoneMutation.mutate(milestone.id)}
                    className="text-white-muted hover:text-lime-soft transition-colors cursor-pointer"
                  >
                    <CheckCircle
                      className={cn(
                        "w-5 h-5",
                        milestone.completed ? "text-lime-soft fill-lime-soft/10" : "text-white-muted/40"
                      )}
                    />
                  </button>
                  <span className={cn(
                    "text-sm",
                    milestone.completed ? "line-through text-white-muted" : "text-white-off"
                  )}>
                    {milestone.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Discussion comments / Notes */}
      <Card className="border border-white/5 text-left space-y-4">
        <h3 className="font-display font-bold text-lg text-white-off">Duo Discussion</h3>

        {/* Post note form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!noteContent) return;
            addNoteMutation.mutate(noteContent);
          }}
          className="space-y-2"
        >
          <Input
            id="noteContent"
            type="text"
            placeholder="Type comment or note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            required
          />
          <Button type="submit" size="sm" className="w-full">
            Post note
          </Button>
        </form>

        {/* History */}
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 pt-2">
          {goal.notes?.length === 0 ? (
            <span className="text-xs text-white-muted block">No notes posted yet.</span>
          ) : (
            goal.notes?.map((note) => (
              <div key={note.id} className="flex gap-3 text-xs bg-black-elevated/40 p-3 rounded-button border border-white/5">
                <div className="space-y-1">
                  <span className="font-bold text-white-off">Member Note</span>
                  <p className="text-white-muted">{note.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Goal"
      >
        <div className="space-y-4 text-left p-2">
          <p className="text-sm text-white-muted">
            Are you sure you want to delete this goal? This action is permanent and cannot be undone.
          </p>
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <Button
              variant="danger"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                setIsDeleteModalOpen(false);
                deleteGoalMutation.mutate();
              }}
              isLoading={deleteGoalMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Yes, Delete Goal
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default GoalDetailPage;
