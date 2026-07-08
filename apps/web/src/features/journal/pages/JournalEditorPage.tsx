import React from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Button from "@/components/ui/Button.tsx";
import { ArrowLeft, Check, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { JournalEntry } from "@duoquest/shared";

export function JournalEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeDuoSpace } = useDuoSpaceStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);

  const duoSpaceId = activeDuoSpace?.id;
  const isEditing = !!id;

  // Fetch entry details if editing
  const { data: entry, isLoading } = useQuery<JournalEntry>({
    queryKey: ["journalEntry", id],
    queryFn: () => api.get(`/api/journal/${id}`),
    enabled: isEditing,
  });

  // Populate state on load
  React.useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setIsPrivate(entry.type === "private");
    }
  }, [entry]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; type: "shared" | "private" }) =>
      api.post(`/api/duo-spaces/${duoSpaceId}/journal`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", duoSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["duoOverview", duoSpaceId] });
      addToast.addToast("Reflection logged! ✍️ (+15 XP)", "success");
      navigate("/journal");
    },
    onError: (err: any) => addToast.addToast(err.message || "Failed to log entry", "error"),
  });

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: (data: { title: string; content: string; type: "shared" | "private" }) =>
      api.patch(`/api/journal/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", duoSpaceId] });
      addToast.addToast("Reflection updated!", "success");
      navigate("/journal");
    },
    onError: (err: any) => addToast.addToast(err.message || "Failed to update entry", "error"),
  });

  const handleSave = () => {
    if (!title.trim()) {
      addToast.addToast("Please add a title for your entry", "error");
      return;
    }
    if (!content.trim()) {
      addToast.addToast("Please write some content", "error");
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      type: (isPrivate ? "private" : "shared") as "shared" | "private",
    };

    if (isEditing) {
      editMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse">
        <span className="text-sm font-semibold text-white-muted">Loading entry editor...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
        <button
          onClick={() => navigate("/journal")}
          className="text-white-muted hover:text-white flex items-center gap-1.5 text-sm font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Journal Feed</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Privacy Switcher */}
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={cn(
              "px-3 py-1.5 rounded-pill text-[10px] uppercase font-bold tracking-wider border flex items-center gap-1.5 transition-all cursor-pointer",
              isPrivate
                ? "bg-purple-warm/15 border-purple-warm/30 text-purple-warm"
                : "bg-lime-soft/15 border-lime-soft/30 text-lime-soft"
            )}
          >
            {isPrivate ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            {isPrivate ? "Private Note" : "Shared to Space"}
          </button>

          <Button
            size="sm"
            onClick={handleSave}
            isLoading={createMutation.isPending || editMutation.isPending}
            className="flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </Button>
        </div>
      </div>

      {/* Notion-style Immersive Editor Canvas */}
      <div className="flex-1 flex flex-col space-y-4 max-w-xl mx-auto w-full text-left px-2">
        {/* Immersive Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled reflection..."
          className="w-full text-3xl font-display font-extrabold bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-white-off placeholder-white-muted/20 select-text p-0"
        />

        {/* Separator line */}
        <div className="h-[1px] bg-white/5 w-full" />

        {/* Immersive Content Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing down your thoughts, achievements, or simple reflections..."
          className="w-full flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-base leading-relaxed text-white-muted placeholder-white-muted/15 resize-none select-text p-0 min-h-[500px]"
        />
      </div>
    </div>
  );
}
export default JournalEditorPage;
