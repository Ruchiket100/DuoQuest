import React from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import ProgressBar from "@/components/ui/ProgressBar.tsx";
import Badge from "@/components/ui/Badge.tsx";
import Modal from "@/components/ui/Modal.tsx";
import Input from "@/components/ui/Input.tsx";
import { Plus, Target, Calendar } from "lucide-react";
import type { Goal } from "@duoquest/shared";

export function GoalsPage() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [goalTitle, setGoalTitle] = React.useState("");
  const [goalDesc, setGoalDesc] = React.useState("");
  const [goalType, setGoalType] = React.useState<"personal" | "shared">("personal");
  const [dueDate, setDueDate] = React.useState("");
  const [selectedEmoji, setSelectedEmoji] = React.useState("🎯");
  const [selectedColor, setSelectedColor] = React.useState("lime");
  const [coverImageFile, setCoverImageFile] = React.useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);

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

  const duoSpaceId = activeDuoSpace?.id;

  // Fetch Goals
  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["duoGoals", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/goals`),
    enabled: !!duoSpaceId,
  });

  // Create Goal Mutation
  const createGoalMutation = useMutation({
    mutationFn: (newGoal: { title: string; description?: string; type: "personal" | "shared"; dueDate?: string; icon?: string; color?: string; imageUrl?: string | null }) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/goals`, newGoal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duoGoals", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsModalOpen(false);
      setGoalTitle("");
      setGoalDesc("");
      setDueDate("");
      setSelectedEmoji("🎯");
      setSelectedColor("lime");
      setCoverImageFile(null);
      addToast.addToast("Goal created! 🎯", "success");
    },
    onError: (err: any) => {
      addToast.addToast(err.message || "Failed to create goal", "error");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    let imageUrl = null;
    if (coverImageFile) {
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", coverImageFile);
        const res = await api.upload<{ imageUrl: string }>(`/api/duo-spaces/${duoSpaceId}/upload-cover`, formData);
        if (res.imageUrl) {
          imageUrl = res.imageUrl;
        }
      } catch (err: any) {
        addToast.addToast("Failed to upload cover photo. Creating goal without it...", "info");
      } finally {
        setUploadingImage(false);
      }
    }

    createGoalMutation.mutate({
      title: goalTitle,
      description: goalDesc,
      type: goalType,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      icon: selectedEmoji,
      color: selectedColor,
      imageUrl,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-black-elevated rounded-card" />
        <div className="h-24 bg-black-elevated rounded-card" />
        <div className="h-24 bg-black-elevated rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1 text-left">
          <h1 className="font-display font-extrabold text-2xl text-white-off">Duo Goals</h1>
          <p className="text-sm text-white-muted">Achieve targets and track milestones together.</p>
        </div>
        <Button className="flex items-center gap-1" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="h-48 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
          <Target className="w-8 h-8 text-white-muted/40 animate-pulse" />
          <span className="text-sm text-white-muted">No goals created yet. Set a goal together!</span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {goals.map((goal) => {
            const theme = getGoalColorTheme(goal.color, goal.type);
            return (
              <Card
                key={goal.id}
                hoverEffect
                className={`border border-white/5 cursor-pointer text-left flex flex-col justify-between overflow-hidden p-0 ${theme.border}`}
                onClick={() => navigate(`/goals/${goal.id}`)}
              >
                {goal.imageUrl && (
                  <div className="w-full h-24 overflow-hidden relative">
                    <img src={goal.imageUrl} alt={goal.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black-card to-transparent" />
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{goal.icon || "🎯"}</span>
                      <h3 className="font-display font-bold text-base text-white-off hover:text-lime-soft transition-colors line-clamp-1">
                        {goal.title}
                      </h3>
                    </div>
                    <Badge variant={goal.type === "shared" ? "secondary" : "primary"}>
                      {goal.type}
                    </Badge>
                  </div>
                  {goal.description && <p className="text-xs text-white-muted line-clamp-2">{goal.description}</p>}
                </div>

                <div className="p-5 pt-0 mt-2 border-t border-white/5 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <ProgressBar value={goal.progress} color={theme.bar} />
                  </div>
                  {goal.dueDate && (
                    <span className="text-[10px] text-white-muted font-semibold shrink-0 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(goal.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Goal Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Duo Goal">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <Input
            id="goalTitle"
            type="text"
            label="Goal Title"
            placeholder="e.g. Learn System Design"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            required
          />

          <Input
            id="goalDesc"
            type="text"
            label="Description"
            placeholder="Outline milestones or targets..."
            value={goalDesc}
            onChange={(e) => setGoalDesc(e.target.value)}
          />

          <Input
            id="dueDate"
            type="date"
            label="Deadline / Target Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider">
              Goal Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["personal", "shared"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGoalType(t)}
                  className={`py-2 px-3 rounded-button text-xs font-semibold border capitalize transition-all cursor-pointer ${
                    goalType === t
                      ? "bg-lime-soft/10 border-lime-soft text-white"
                      : "bg-black-elevated border-white/5 text-white-muted hover:border-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Picker */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Choose Icon
            </label>
            <div className="grid grid-cols-5 gap-2 bg-black-deep/40 p-2 rounded-button border border-white/5 max-h-32 overflow-y-auto">
              {["🎯", "📚", "💻", "🏃", "🧘", "🎨", "✈️", "💸", "🎵", "🥦", "🔥", "🚀", "💡", "🛠️", "🤝"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-xl p-2 rounded-card transition-all cursor-pointer hover:bg-white/5 ${
                    selectedEmoji === emoji ? "bg-white/10 scale-110 shadow" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Theme Selector */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Accent Color
            </label>
            <div className="flex gap-3 bg-black-deep/40 p-2.5 rounded-button border border-white/5">
              {[
                { key: "lime", bg: "bg-lime-soft" },
                { key: "purple", bg: "bg-purple-warm" },
                { key: "orange", bg: "bg-orange-500" },
                { key: "blue", bg: "bg-blue-400" },
                { key: "rose", bg: "bg-rose-500" },
              ].map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setSelectedColor(theme.key)}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer hover:scale-115 ${theme.bg} ${
                    selectedColor === theme.key ? "ring-2 ring-white scale-110 shadow-float" : "opacity-80"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Cover Photo Upload */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="coverImage" className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Custom Cover Photo (Optional)
            </label>
            <input
              id="coverImage"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setCoverImageFile(file);
              }}
              className="w-full text-xs text-white-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-button file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10 cursor-pointer"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full mt-2" 
            isLoading={createGoalMutation.isPending || uploadingImage}
          >
            Create Goal
          </Button>
        </form>
      </Modal>
    </div>
  );
}
export default GoalsPage;
