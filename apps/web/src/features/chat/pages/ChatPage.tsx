import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import api from "@/lib/api.ts";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import Button from "@/components/ui/Button.tsx";
import Input from "@/components/ui/Input.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import { Send, Bell } from "lucide-react";
import type { Message } from "@duoquest/shared";

// Create client helper (conditional matching schema/VITE_ envs)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function ChatPage() {
  const { user } = useAuthStore();
  const { activeDuoSpace } = useDuoSpaceStore();
  const queryClient = useQueryClient();

  const [messageText, setMessageText] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const duoSpaceId = activeDuoSpace?.id;

  // Fetch Message History
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["chatHistory", duoSpaceId],
    queryFn: () => api.get(`/api/duo-spaces/${duoSpaceId}/messages`),
    enabled: !!duoSpaceId,
  });

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      api.post<Message>(`/api/duo-spaces/${duoSpaceId}/messages`, { content, type: "text" }),
    onSuccess: (newMessage: Message) => {
      setMessageText("");
      // Optimistic update or manual refetch
      queryClient.setQueryData<Message[]>(["chatHistory", duoSpaceId], (old = []) => [...old, newMessage]);
      scrollToBottom();
    },
  });

  // Setup Realtime Subscription
  React.useEffect(() => {
    if (!duoSpaceId || !supabase) return;

    let channel: RealtimeChannel;
    try {
      channel = supabase
        .channel(`duo-chat:${duoSpaceId}`)
        .on("broadcast", { event: "new_message" }, (payload) => {
          const newMessage = payload.payload;
          if (newMessage && newMessage.senderId !== user?.id) {
            queryClient.setQueryData<Message[]>(["chatHistory", duoSpaceId], (old = []) => [
              ...old,
              newMessage,
            ]);
            scrollToBottom();
          }
        })
        .subscribe();
    } catch (err) {
      console.error("Supabase Realtime subscription error", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [duoSpaceId, queryClient, user?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  React.useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    sendMessageMutation.mutate(messageText);
  };

  if (!duoSpaceId) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-2">
        <span className="text-sm text-white-muted">No active Duo Space found. Please set one up on the Home page first!</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <span className="text-sm text-white-muted animate-pulse">Loading discussion logs...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[75vh] w-full max-w-xl mx-auto rounded-card border border-white/5 bg-black-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-black-elevated/40 text-left">
        <div className="w-2.5 h-2.5 bg-green-accent rounded-full animate-pulse-glow shrink-0" />
        <div className="flex-1">
          <h3 className="font-display font-bold text-sm text-white-off">Multiplayer Chat</h3>
          <p className="text-[10px] text-white-muted">Sync with your partner in real time</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white-muted gap-2">
            <span className="text-4xl">👋</span>
            <span className="text-xs">Start a conversation. Keep each other accountable.</span>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId === user?.id;
            const isSystem = message.type === "system";
            const isNudge = message.type === "nudge";

            if (isSystem) {
              return (
                <div key={message.id} className="flex justify-center my-2">
                  <div className="flex items-center gap-1.5 bg-purple-deep/10 border border-purple-warm/20 text-purple-warm px-3 py-1 rounded-pill text-[10px] font-bold">
                    <Bell className="w-3 h-3" />
                    <span>{message.content}</span>
                  </div>
                </div>
              );
            }

            if (isNudge) {
              return (
                <div key={message.id} className="flex justify-center my-2">
                  <div className="flex items-center gap-1.5 bg-lime-soft/10 border border-lime-soft/20 text-lime-soft px-3 py-1.5 rounded-button text-xs font-semibold">
                    <span>👋 Nudge from partner: "{message.content}"</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-2.5 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <Avatar src={message.sender?.avatarUrl} name={message.sender?.username} size="sm" />
                <div className="space-y-1">
                  <span className={`text-[10px] block ${isMe ? "text-right" : "text-left"} text-white-muted`}>
                    {message.sender?.username}
                  </span>
                  <div
                    className={`px-4 py-2.5 rounded-card text-sm text-left ${
                      isMe
                        ? "bg-lime-soft text-black-deep rounded-tr-none font-medium"
                        : "bg-black-elevated text-white-off rounded-tl-none border border-white/5"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-black-elevated/20 flex gap-2">
        <Input
          id="messageText"
          type="text"
          placeholder="Send text or emoji..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          className="py-2 px-3 border-white/5 shrink"
        />
        <Button type="submit" size="sm" className="shrink-0 rounded-button">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
export default ChatPage;
