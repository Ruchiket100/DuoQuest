import React from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useAuthStore } from "@/stores/authStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import Badge from "@/components/ui/Badge.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import Modal from "@/components/ui/Modal.tsx";
import api from "@/lib/api.ts";
import { BookOpen, Plus, Lock, Users, Calendar, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { JournalEntry } from "@duoquest/shared";

const JOURNAL_PROMPTS = [
  "What is one thing your partner did today that you appreciate?",
  "What was the biggest challenge you tackled today, and how did you feel?",
  "Describe a small victory or milestone you reached today.",
  "Write down three things you are grateful for right now.",
  "How did you progress towards your shared goals today?",
  "What are you looking forward to achieving tomorrow?",
];

export function JournalPage() {
  const { activeDuoSpace } = useDuoSpaceStore();
  const { user } = useAuthStore();
  const addToast = useUIStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState<"shared" | "private">("shared");
  const [randomPrompt, setRandomPrompt] = React.useState("");
  const [deleteEntryId, setDeleteEntryId] = React.useState<string | null>(null);

  const duoSpaceId = activeDuoSpace?.id;

  // Set prompt on mount
  React.useEffect(() => {
    const idx = Math.floor(Math.random() * JOURNAL_PROMPTS.length);
    setRandomPrompt(JOURNAL_PROMPTS[idx]);
  }, []);

  // Fetch Journal Entries
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journalEntries", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/journal`),
    enabled: !!duoSpaceId,
  });

  // Mark all viewed on mount or tab change
  React.useEffect(() => {
    if (duoSpaceId) {
      localStorage.setItem(`last_viewed_journal_time:${duoSpaceId}`, new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["unreadJournalCount", duoSpaceId] });
    }
  }, [duoSpaceId, entries, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => api.delete(`/api/journal/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", duoSpaceId] });
      addToast.addToast("Journal entry deleted", "success");
    },
    onError: (err: any) => addToast.addToast(err.message || "Failed to delete entry", "error"),
  });

  const filteredEntries = entries.filter((e) => e.type === activeTab);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1 text-left">
          <h1 className="font-display font-extrabold text-2xl text-white-off">Duo Journal</h1>
          <p className="text-sm text-white-muted">Reflect, track thoughts, and write space diaries together.</p>
        </div>
        <Button className="flex items-center gap-1" onClick={() => navigate("/journal/new")}>
          <Plus className="w-4 h-4" />
          <span>New Entry</span>
        </Button>
      </div>

      {/* Tabs Layout */}
      <div className="flex bg-black-elevated p-1 rounded-pill border border-white/5 w-full">
        {(["shared", "private"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-pill capitalize transition-all cursor-pointer flex items-center justify-center gap-1.5",
              activeTab === tab
                ? "bg-white/10 text-white shadow-float"
                : "text-white-muted hover:text-white"
            )}
          >
            {tab === "shared" ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {tab === "shared" ? "Duo Space" : "Personal Diary"}
          </button>
        ))}
      </div>

      {/* Journal prompts card */}
      <Card className="bg-gradient-to-r from-purple-deep/10 to-lime-soft/5 border border-white/5 text-left p-4">
        <span className="text-[10px] uppercase font-bold text-lime-soft tracking-widest block mb-1">
          Daily Reflection Suggestion
        </span>
        <p className="text-xs text-white-off italic font-medium">"{randomPrompt}"</p>
      </Card>

      {/* Feed stack */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-black-elevated rounded-card" />
          <div className="h-24 bg-black-elevated rounded-card" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="h-48 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
          <BookOpen className="w-8 h-8 text-white-muted/40 animate-pulse" />
          <span className="text-sm text-white-muted">
            {activeTab === "shared"
              ? "No shared reflections yet. Write your first duo memory!"
              : "Your personal diary is empty. Log a private note."}
          </span>
        </Card>
      ) : (
        <div className="space-y-4 text-left">
          {filteredEntries.map((entry) => (
            <Card
              key={entry.id}
              className="border border-white/5 p-5 relative group flex flex-col justify-between hover:border-white/10 transition-colors"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {entry.type === "shared" && entry.user && (
                      <Avatar src={entry.user.avatarUrl} name={entry.user.displayName || entry.user.username} size="sm" />
                    )}
                    <div>
                      <h3 className="font-display font-bold text-base text-white-off leading-snug">
                        {entry.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-white-muted font-semibold mt-0.5">
                        {entry.type === "shared" && entry.user && (
                          <span>by @{entry.user.displayName || entry.user.username}</span>
                        )}
                        {entry.type === "shared" && entry.user && (
                          <span className="h-1 w-1 bg-white/20 rounded-full" />
                        )}
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={entry.type === "private" ? "primary" : "secondary"}>
                      {entry.type === "private" ? "private" : "shared"}
                    </Badge>
                    {(entry.userId === user?.id || entry.type === "shared") && (
                      <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all duration-200">
                        <button
                          onClick={() => navigate(`/journal/edit/${entry.id}`)}
                          className="p-1 rounded-card text-white-muted hover:text-lime-soft hover:bg-lime-soft/10 transition-colors cursor-pointer"
                          title="Edit entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {entry.userId === user?.id && (
                          <button
                            onClick={() => setDeleteEntryId(entry.id)}
                            className="p-1 rounded-card text-white-muted hover:text-red-accent hover:bg-red-accent/10 transition-colors cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs text-white-muted leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        title="Delete Journal Entry"
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-white-muted">
            Are you sure you want to delete this journal entry? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => setDeleteEntryId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="bg-red-accent/10 hover:bg-red-accent/20 text-red-accent border-red-accent/20"
              isLoading={deleteMutation.isPending}
              onClick={() => {
                if (deleteEntryId) {
                  deleteMutation.mutate(deleteEntryId, {
                    onSuccess: () => {
                      setDeleteEntryId(null);
                    },
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default JournalPage;
