import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useAuthStore } from "@/stores/authStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import Modal from "@/components/ui/Modal.tsx";
import Input from "@/components/ui/Input.tsx";
import Badge from "@/components/ui/Badge.tsx";
import api from "@/lib/api.ts";
import { Trophy, Plus, Flame, CheckCircle2, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const CHALLENGE_TYPES = [
  { value: "fitness", label: "Fitness", emoji: "🏋️" },
  { value: "coding", label: "Coding", emoji: "💻" },
  { value: "reading", label: "Reading", emoji: "📚" },
  { value: "custom", label: "Custom", emoji: "✏️" },
] as const;

const DURATION_OPTIONS = [
  { days: 7, label: "1 Week" },
  { days: 14, label: "2 Weeks" },
  { days: 21, label: "3 Weeks" },
  { days: 30, label: "30 Days" },
];

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: string;
  targetDays: number;
  startDate: string;
  endDate: string;
  status: string;
  icon?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  participants: {
    id: string;
    userId: string;
    daysCompleted: number;
    lastCheckIn: string | null;
    user: { id: string; username: string; avatarUrl: string | null };
  }[];
}

export default function ChallengesPage() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const { user } = useAuthStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<string>("custom");
  const [targetDays, setTargetDays] = React.useState(7);
  const [selectedEmoji, setSelectedEmoji] = React.useState("🔥");
  const [selectedColor, setSelectedColor] = React.useState("lime");
  const [coverImageFile, setCoverImageFile] = React.useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  const duoSpaceId = activeDuoSpace?.id;

  const { data: challenges = [], isLoading } = useQuery<Challenge[]>({
    queryKey: ["challenges", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/challenges`),
    enabled: !!duoSpaceId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; type: string; targetDays: number; icon?: string; color?: string; imageUrl?: string | null }) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/challenges`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges", duoSpaceId] });
      setIsCreateOpen(false);
      setTitle("");
      setSelectedEmoji("🔥");
      setSelectedColor("lime");
      setCoverImageFile(null);
      addToast.addToast("Challenge created! 🔥", "success");
    },
    onError: (err: any) => addToast.addToast(err.message, "error"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let imageUrl = null;
    if (coverImageFile) {
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", coverImageFile);
        const res = await api.post<any>(`/api/duo-spaces/${duoSpaceId}/upload-cover`, {
          method: "POST",
          body: formData,
        });
        if (res.imageUrl) {
          imageUrl = res.imageUrl;
        }
      } catch (err: any) {
        addToast.addToast("Failed to upload cover photo. Starting challenge without it...", "info");
      } finally {
        setUploadingImage(false);
      }
    }

    createMutation.mutate({
      title,
      type,
      targetDays,
      icon: selectedEmoji,
      color: selectedColor,
      imageUrl,
    });
  };

  const checkInMutation = useMutation({
    mutationFn: (challengeId: string) =>
      api.post(`/api/challenges/${challengeId}/check-in`, {}),
    onMutate: async (challengeId) => {
      await queryClient.cancelQueries({ queryKey: ["challenges", duoSpaceId] });
      const previous = queryClient.getQueryData<Challenge[]>(["challenges", duoSpaceId]);

      // Optimistically update the participant's check-in
      queryClient.setQueryData<Challenge[]>(["challenges", duoSpaceId], (old) =>
        old?.map((c) =>
          c.id === challengeId
            ? {
                ...c,
                participants: c.participants.map((p) =>
                  p.userId === user?.id
                    ? { ...p, daysCompleted: p.daysCompleted + 1, lastCheckIn: new Date().toISOString() }
                    : p
                ),
              }
            : c
        )
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["challenges", duoSpaceId], context.previous);
      }
      addToast.addToast("Failed to check in", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  const activeChallenges = challenges.filter((c) => c.status === "active");
  const pastChallenges = challenges.filter((c) => c.status !== "active");

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            <Trophy className="inline w-6 h-6 mr-2 text-gold" />
            Challenges
          </h1>
          <p className="text-sm text-white-muted mt-1">
            Push each other with timed challenges
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      {/* Active Challenges */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-card bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : activeChallenges.length === 0 ? (
        <Card className="text-center py-12 space-y-3">
          <Trophy className="w-10 h-10 text-white-muted mx-auto" />
          <p className="text-white-muted text-sm font-medium">
            No active challenges yet
          </p>
          <p className="text-white-muted/60 text-xs">
            Start a challenge to keep each other accountable!
          </p>
        </Card>
      ) : (
        activeChallenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            currentUserId={user?.id || ""}
            onCheckIn={() => checkInMutation.mutate(challenge.id)}
            isCheckingIn={checkInMutation.isPending}
          />
        ))
      )}

      {/* Past Challenges */}
      {pastChallenges.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white-muted uppercase tracking-wider">
            Past Challenges
          </h2>
          {pastChallenges.map((challenge) => (
            <Card key={challenge.id} className="p-4 opacity-60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white">
                    {challenge.title}
                  </h3>
                  <p className="text-xs text-white-muted mt-0.5">
                    {challenge.targetDays} day challenge
                  </p>
                </div>
                <Badge
                  variant={challenge.status === "completed" ? "success" : "secondary"}
                >
                  {challenge.status === "completed" ? "Completed ✅" : "Expired"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Start a Challenge"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-5 text-left"
        >
          <Input
            id="challengeTitle"
            label="Challenge Name"
            placeholder="e.g. 30 Days of Running"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Type Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CHALLENGE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 px-2 rounded-card border text-xs font-semibold transition-all duration-200",
                    type === t.value
                      ? "border-lime-soft/50 bg-lime-soft/10 text-lime-soft"
                      : "border-white/5 bg-white/[0.02] text-white-muted hover:bg-white/5"
                  )}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  onClick={() => setTargetDays(d.days)}
                  className={cn(
                    "py-2.5 px-2 rounded-button border text-xs font-bold transition-all duration-200",
                    targetDays === d.days
                      ? "border-purple-warm/50 bg-purple-warm/10 text-purple-warm"
                      : "border-white/5 bg-white/[0.02] text-white-muted hover:bg-white/5"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Choose Icon
            </label>
            <div className="grid grid-cols-5 gap-2 bg-black-deep/40 p-2 rounded-button border border-white/5 max-h-32 overflow-y-auto">
              {["🔥", "🏃", "💻", "📚", "🧘", "🍏", "💧", "🏋️", "🚶", "🚭", "🎨", "🚀", "⏰", "📅", "💪"].map((emoji) => (
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
            className="w-full"
            isLoading={createMutation.isPending || uploadingImage}
          >
            <Flame className="w-4 h-4 mr-1" />
            Start Challenge
          </Button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Challenge Card Component ───
function ChallengeCard({
  challenge,
  currentUserId,
  onCheckIn,
  isCheckingIn,
}: {
  challenge: Challenge;
  currentUserId: string;
  onCheckIn: () => void;
  isCheckingIn: boolean;
}) {
  const myParticipant = challenge.participants.find(
    (p) => p.userId === currentUserId
  );
  const partnerParticipant = challenge.participants.find(
    (p) => p.userId !== currentUserId
  );

  const daysElapsed = Math.max(
    1,
    Math.ceil(
      (Date.now() - new Date(challenge.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const daysRemaining = Math.max(0, challenge.targetDays - daysElapsed);
  const progress = Math.min(100, (daysElapsed / challenge.targetDays) * 100);

  // Check if already checked in today
  const today = new Date().toISOString().split("T")[0];
  const hasCheckedInToday =
    myParticipant?.lastCheckIn &&
    new Date(myParticipant.lastCheckIn).toISOString().split("T")[0] === today;

  const typeInfo = CHALLENGE_TYPES.find((t) => t.value === challenge.type);

  const getChallengeTheme = (color: string | null | undefined) => {
    const defaults = { border: "hover:border-lime-soft/30", text: "text-lime-soft", barGradients: "from-lime-soft to-purple-warm" };
    if (!color) return defaults;
    switch (color) {
      case "lime":
        return { border: "hover:border-lime-soft/30", text: "text-lime-soft", barGradients: "from-lime-soft to-lime-soft/60" };
      case "purple":
        return { border: "hover:border-purple-warm/30", text: "text-purple-warm", barGradients: "from-purple-warm to-purple-warm/60" };
      case "orange":
        return { border: "hover:border-orange-500/30", text: "text-orange-500", barGradients: "from-orange-500 to-orange-500/60" };
      case "blue":
        return { border: "hover:border-blue-400/30", text: "text-blue-400", barGradients: "from-blue-400 to-blue-400/60" };
      case "rose":
        return { border: "hover:border-rose-500/30", text: "text-rose-500", barGradients: "from-rose-500 to-rose-500/60" };
      default:
        return defaults;
    }
  };

  const theme = getChallengeTheme(challenge.color);

  return (
    <Card className={cn("text-left p-0 overflow-hidden border border-white/5", theme.border)}>
      {challenge.imageUrl && (
        <div className="w-full h-28 overflow-hidden relative">
          <img src={challenge.imageUrl} alt={challenge.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black-card to-transparent" />
        </div>
      )}
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{challenge.icon || typeInfo?.emoji || "🔥"}</span>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                {challenge.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-white-muted" />
                <span className="text-xs text-white-muted">
                  {daysRemaining > 0
                    ? `${daysRemaining} days remaining`
                    : "Final day!"}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="secondary">Day {Math.min(daysElapsed, challenge.targetDays)}/{challenge.targetDays}</Badge>
        </div>

        {/* Timeline Progress */}
        <div className="space-y-2">
          <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn("absolute inset-y-0 left-0 bg-gradient-to-r rounded-full transition-all duration-500", theme.barGradients)}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Day markers */}
          <div className="flex justify-between">
            {Array.from({ length: Math.min(challenge.targetDays, 14) }, (_, i) => {
              const dayIndex = challenge.targetDays <= 14 ? i : Math.round((i / 13) * (challenge.targetDays - 1));
              const myDone = (myParticipant?.daysCompleted || 0) > dayIndex;
              const partnerDone = (partnerParticipant?.daysCompleted || 0) > dayIndex;
              const bothDone = myDone && partnerDone;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    bothDone
                      ? "bg-gradient-to-br from-lime-soft to-purple-warm shadow-[0_0_6px_rgba(193,240,89,0.3)]"
                      : myDone
                      ? "bg-lime-soft"
                      : partnerDone
                      ? "bg-purple-warm"
                      : "bg-white/10"
                  )}
                  title={`Day ${dayIndex + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* Participant Progress */}
        <div className="grid grid-cols-2 gap-3">
          {[myParticipant, partnerParticipant].map((p) => {
            if (!p) return null;
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 bg-white/[0.03] rounded-button px-3 py-2 border",
                  isMe ? "border-lime-soft/20" : "border-purple-warm/20"
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isMe ? "bg-lime-soft" : "bg-purple-warm"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {isMe ? "You" : `@${p.user.username}`}
                  </p>
                  <p className="text-[10px] text-white-muted">
                    {p.daysCompleted}/{challenge.targetDays} days
                  </p>
                </div>
                <Zap
                  className={cn(
                    "w-3.5 h-3.5",
                    isMe ? "text-lime-soft" : "text-purple-warm"
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Check-in Button */}
        {!hasCheckedInToday ? (
          <Button
            className="w-full"
            onClick={onCheckIn}
            isLoading={isCheckingIn}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Check In for Today
          </Button>
        ) : (
          <div className="text-center py-2">
            <span className="text-sm text-lime-soft font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Checked in today ✓
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
