import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useAuthStore } from "@/stores/authStore.ts";
import Card from "@/components/ui/Card.tsx";
import api from "@/lib/api.ts";
import { cn } from "@/lib/utils.ts";

const MOODS = [
  { value: "angry", emoji: "😤", label: "Frustrated" },
  { value: "meh", emoji: "😐", label: "Meh" },
  { value: "ok", emoji: "🙂", label: "OK" },
  { value: "happy", emoji: "😊", label: "Happy" },
  { value: "fire", emoji: "🔥", label: "On Fire!" },
] as const;

export default function MoodCheckIn() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const duoSpaceId = activeDuoSpace?.id;

  const { data: moods = [] } = useQuery<any[]>({
    queryKey: ["moods", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/moods`),
    enabled: !!duoSpaceId,
  });

  // Check if current user already logged mood today
  const myMood = moods.find((m: any) => m.userId === user?.id);
  const partnerMood = moods.find((m: any) => m.userId !== user?.id);
  const myMoodValue = (myMood?.metadata as any)?.mood;
  const partnerMoodValue = (partnerMood?.metadata as any)?.mood;

  const mutation = useMutation({
    mutationFn: (mood: string) => api.post("/api/users/mood", { mood }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moods", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  return (
    <Card className="p-4 border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm text-white-off">
          How are you feeling?
        </h3>
        {partnerMoodValue && (
          <span className="text-xs text-white-muted">
            Partner: {MOODS.find((m) => m.value === partnerMoodValue)?.emoji || "❓"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        {MOODS.map((mood) => {
          const isSelected = myMoodValue === mood.value;
          return (
            <button
              key={mood.value}
              onClick={() => {
                if (!myMoodValue) mutation.mutate(mood.value);
              }}
              disabled={!!myMoodValue || mutation.isPending}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-2.5 rounded-card transition-all duration-200",
                isSelected
                  ? "bg-lime-soft/10 border border-lime-soft/30 scale-110"
                  : myMoodValue
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-white/5 hover:scale-105 cursor-pointer border border-transparent"
              )}
            >
              <span className="text-xl">{mood.emoji}</span>
              <span className="text-[9px] text-white-muted font-semibold">
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>

      {myMoodValue && (
        <p className="text-[10px] text-center text-white-muted/60">
          You're feeling {MOODS.find((m) => m.value === myMoodValue)?.label?.toLowerCase() || myMoodValue} today
        </p>
      )}
    </Card>
  );
}
