import React from "react";
import { useAuthStore } from "@/stores/authStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Card from "@/components/ui/Card.tsx";
import Button from "@/components/ui/Button.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import Badge from "@/components/ui/Badge.tsx";
import ProgressBar from "@/components/ui/ProgressBar.tsx";
import Modal from "@/components/ui/Modal.tsx";
import Input from "@/components/ui/Input.tsx";
import { LogOut, Settings, Award, Users, Camera, BarChart3, Trash2 } from "lucide-react";
import { ACHIEVEMENT_DEFINITIONS } from "@duoquest/shared";
import api from "@/lib/api.ts";
import { cn } from "@/lib/utils.ts";

export function ProfilePage() {
  const { user: rawUser, logout } = useAuthStore();
  const user = rawUser as any;
  const addToast = useUIStore();
  const navigate = useNavigate();

  const { activeDuoSpace, setActiveDuoSpace } = useDuoSpaceStore();
  const [isDuoModalOpen, setIsDuoModalOpen] = React.useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = React.useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = React.useState(false);
  const [spaceName, setSpaceName] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  const queryClient = useQueryClient();

  // Query cached overview to retrieve member list
  const { data: overview } = useQuery<any>({
    queryKey: ["duoOverview", activeDuoSpace?.id],
    queryFn: () => api.get(`/api/duo-spaces/${activeDuoSpace?.id}/overview`),
    enabled: !!activeDuoSpace?.id,
  });

  const partner = overview?.members?.find((m: any) => m.userId !== user?.id);
  const isOwner = overview?.members?.some((m: any) => m.userId === user?.id && m.role === "owner") ?? false;

  React.useEffect(() => {
    if (activeDuoSpace) {
      setSpaceName(activeDuoSpace.name);
    }
  }, [activeDuoSpace]);

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/sign-out");
      logout();
      navigate("/login");
      addToast.addToast("Signed out successfully", "success");
    } catch {
      // Fallback local signout
      logout();
      navigate("/login");
    }
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDuoSpace || !spaceName) return;
    setIsUpdating(true);
    try {
      const updated = await api.patch<any>(`/api/duo-spaces/${activeDuoSpace.id}`, { name: spaceName });
      setActiveDuoSpace(updated);
      addToast.addToast("Duo Space updated!", "success");
      setIsDuoModalOpen(false);
    } catch (err: any) {
      addToast.addToast(err.message || "Failed to update", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLeaveSpace = async () => {
    if (!activeDuoSpace) return;
    if (!confirm("Are you sure you want to leave this Duo Space? This will delete all shared history if you are the last member.")) return;
    setIsUpdating(true);
    try {
      await api.post(`/api/duo-spaces/${activeDuoSpace.id}/leave`, {});
      setActiveDuoSpace(null);
      addToast.addToast("Left Duo Space", "info");
      setIsDuoModalOpen(false);
      navigate("/onboarding");
    } catch (err: any) {
      addToast.addToast(err.message || "Failed to leave", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePartner = async () => {
    if (!activeDuoSpace || !partner) return;
    if (!confirm(`Are you sure you want to remove @${partner.user.username} from this Duo Space?`)) return;
    setIsUpdating(true);
    try {
      await api.post(`/api/duo-spaces/${activeDuoSpace.id}/remove-partner`, {});
      queryClient.invalidateQueries({ queryKey: ["duoOverview", activeDuoSpace.id] });
      addToast.addToast(`Removed @${partner.user.username}`, "info");
      setIsDuoModalOpen(false);
    } catch (err: any) {
      addToast.addToast(err.message || "Failed to remove partner", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.upload<{ avatarUrl: string }>("/api/users/avatar", formData);
      // Update local state with cache-busting query parameter
      const bustedUrl = `${result.avatarUrl}?t=${Date.now()}`;
      useAuthStore.getState().setUser({ ...user!, avatarUrl: bustedUrl });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      addToast.addToast("Avatar updated!", "success");
    } catch (err: any) {
      addToast.addToast(err.message || "Failed to upload avatar", "error");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setIsRemovingAvatar(true);
    try {
      await api.delete("/api/users/avatar");
      useAuthStore.getState().setUser({ ...user!, avatarUrl: null });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      addToast.addToast("Avatar removed!", "success");
      setIsAvatarModalOpen(false);
    } catch (err: any) {
      addToast.addToast(err.message || "Failed to remove avatar", "error");
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h1 className="font-display font-extrabold text-2xl text-white-off">My Profile</h1>
        <p className="text-sm text-white-muted">Manage your personal settings and achievements.</p>
      </div>

      {/* Hero Profile Details */}
      <Card className="flex flex-col items-center text-center gap-4">
        {/* Avatar with upload overlay */}
        <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
          <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="xl" />
          {isUploadingAvatar ? (
            <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50">
              <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <div className="absolute top-0 right-0 bg-lime-soft text-black p-1.5 rounded-full shadow-md hover:scale-105 transition-transform z-10">
              <Camera className="w-3.5 h-3.5" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
        <div className="space-y-1">
          <h2 className="font-display font-bold text-xl text-white-off">
            {user.displayName || user.username}
          </h2>
          <p className="text-sm text-white-muted">@{user.username}</p>
        </div>

        <div className="flex gap-2">
          <Badge variant="secondary">Level {user.level}</Badge>
          <Badge variant="primary">{user.xp} XP</Badge>
        </div>

        <div className="w-full max-w-xs">
          <ProgressBar value={getLevelProgress(user.xp)} color="purple" showText />
        </div>
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* Duo Space Settings */}
        {activeDuoSpace && (
          <Card
            onClick={() => setIsDuoModalOpen(true)}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-warm" />
              <div>
                <h4 className="font-semibold text-sm text-white">Manage Duo Space</h4>
                <p className="text-xs text-white-muted">Rename, leave, or view invite settings</p>
              </div>
            </div>
          </Card>
        )}

        <Card
          onClick={() => setIsAchievementsModalOpen(true)}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-gold" />
            <div>
              <h4 className="font-semibold text-sm text-white">Achievements</h4>
              <p className="text-xs text-white-muted">Showcase your accountability awards</p>
            </div>
          </div>
          <span className="text-xs text-white-muted font-bold">
            {user.achievements?.length || 0} / {ACHIEVEMENT_DEFINITIONS.length} Unlocked
          </span>
        </Card>

        <Card
          onClick={() => navigate("/stats")}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-purple-warm" />
            <div>
              <h4 className="font-semibold text-sm text-white">Stats & Insights</h4>
              <p className="text-xs text-white-muted">View heatmap, streaks, and scores</p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-all text-left">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-white-muted" />
            <div>
              <h4 className="font-semibold text-sm text-white">Edit Profile</h4>
              <p className="text-xs text-white-muted">Customize avatar, display name and theme</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Logout button */}
      <Button variant="danger" className="w-full flex items-center justify-center gap-2" onClick={handleLogout}>
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </Button>

      {/* ─── Manage Duo Space Modal ─── */}
      <Modal isOpen={isDuoModalOpen} onClose={() => setIsDuoModalOpen(false)} title="Duo Space Settings">
        <form onSubmit={handleSaveSpace} className="space-y-4 text-left">
          <Input
            id="duoSpaceNameEdit"
            type="text"
            label="Duo Space Name"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            required
          />

          <div className="space-y-1">
            <span className="text-xs font-semibold text-white-muted uppercase tracking-wider block">
              Invite Code
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-bold text-base text-lime-soft bg-black-elevated px-3 py-2 rounded-button border border-white/5 tracking-wider select-text flex-1">
                {activeDuoSpace?.inviteCode}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(activeDuoSpace?.inviteCode || "");
                  addToast.addToast("Invite code copied!", "success");
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
            <Button type="submit" isLoading={isUpdating}>
              Save Name
            </Button>
            {isOwner && partner && (
              <Button
                type="button"
                variant="danger"
                onClick={handleRemovePartner}
                isLoading={isUpdating}
              >
                Remove Partner (@{partner.user.username})
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="text-red-accent hover:bg-red-accent/10"
              onClick={handleLeaveSpace}
              isLoading={isUpdating}
            >
              Leave Duo Space
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Achievements Modal ─── */}
      <Modal isOpen={isAchievementsModalOpen} onClose={() => setIsAchievementsModalOpen(false)} title="Achievements">
        <div className="space-y-4 text-left max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-white-muted mb-2 font-medium">
            Unlock accountability awards by maintaining streaks, finishing goals, and working together.
          </p>
          <div className="grid grid-cols-1 gap-2.5">
            {ACHIEVEMENT_DEFINITIONS.map((def) => {
              const isUnlocked = user.achievements?.some(
                (ua: any) => ua.achievement.key === def.key
              );

              return (
                <div
                  key={def.key}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-card border transition-all duration-200",
                    isUnlocked
                      ? "bg-purple-warm/5 border-purple-warm/25 shadow-glow-purple/5"
                      : "bg-black-elevated/40 border-white/5 opacity-55 grayscale-[40%]"
                  )}
                >
                  <div className="text-2xl">{def.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-white-off leading-none">
                        {def.title}
                      </h4>
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-[4px] tracking-wider leading-none shrink-0",
                        isUnlocked
                          ? "bg-lime-soft/10 text-lime-soft"
                          : "bg-white/10 text-white-muted"
                      )}>
                        +{def.xpReward} XP
                      </span>
                    </div>
                    <p className="text-xs text-white-muted mt-1 leading-snug">
                      {def.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ─── Avatar Options Modal ─── */}
      <Modal isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} title="Profile Picture">
        <div className="space-y-3.5 text-center p-2">
          <Button
            variant="primary"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              setIsAvatarModalOpen(false);
              fileInputRef.current?.click();
            }}
          >
            <Camera className="w-4 h-4" />
            Upload New Photo
          </Button>

          {user.avatarUrl && (
            <Button
              variant="danger"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleRemoveAvatar}
              isLoading={isRemovingAvatar}
            >
              <Trash2 className="w-4 h-4" />
              Remove Current Photo
            </Button>
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setIsAvatarModalOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Level Calculation Helper Stubs for Progress Bar ───
function getLevelProgress(xp: number): number {
  const currentLevelXp = Math.floor(xp / 1000) * 1000;
  const progress = xp - currentLevelXp;
  return Math.round((progress / 1000) * 100);
}

export default ProfilePage;
