import React from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Input from "@/components/ui/Input.tsx";
import Button from "@/components/ui/Button.tsx";
import Card from "@/components/ui/Card.tsx";
import Avatar from "@/components/ui/Avatar.tsx";
import { Camera } from "lucide-react";
import type { DuoSpace } from "@duoquest/shared";

export function OnboardingPage() {
  const [step, setStep] = React.useState<"profile" | "duo">("profile");
  const [displayName, setDisplayName] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [theme, setTheme] = React.useState("default");

  const [duoOption, setDuoOption] = React.useState<"create" | "join" | null>(null);
  const [spaceName, setSpaceName] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

  const { user, setUser } = useAuthStore();
  const setActiveDuoSpace = useDuoSpaceStore((state) => state.setActiveDuoSpace);
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setAvatarUrl(user.avatarUrl || "");
      setTheme(user.theme || "default");
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.upload<{ avatarUrl: string }>("/api/users/avatar", formData);
      setAvatarUrl(result.avatarUrl);
      addToast("Avatar uploaded! 📸", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to upload avatar", "error");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updatedUser = await api.patch<any>("/api/users/me", {
        displayName,
        avatarUrl: avatarUrl || undefined,
        theme,
      });
      setUser(updatedUser);
      setStep("duo");
      addToast("Profile saved!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update profile", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duoOption) return;

    setIsLoading(true);
    try {
      if (duoOption === "create") {
        if (!spaceName) {
          addToast("Duo space name is required", "error");
          setIsLoading(false);
          return;
        }
        const space = await api.post<DuoSpace>("/api/duo-spaces", {
          name: spaceName,
        });
        setActiveDuoSpace(space);
        addToast(`Duo Space "${spaceName}" created!`, "success");
      } else {
        if (!inviteCode) {
          addToast("Invite code is required", "error");
          setIsLoading(false);
          return;
        }
        const space = await api.post<DuoSpace>("/api/duo-spaces/join", {
          inviteCode,
        });
        setActiveDuoSpace(space);
        addToast(`Joined space successfully!`, "success");
      }
      navigate("/");
    } catch (err: any) {
      addToast(err.message || "Action failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black-deep flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-white-muted uppercase tracking-widest">
          <span className={step === "profile" ? "text-lime-soft font-bold" : ""}>1. Profile</span>
          <span className="h-px w-8 bg-white/10" />
          <span className={step === "duo" ? "text-lime-soft font-bold" : ""}>2. Join Duo</span>
        </div>

        {step === "profile" ? (
          <Card className="border border-white/5 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-display font-bold text-xl text-white-off">Customize Profile</h2>
              <p className="text-sm text-white-muted">How should your partner see you?</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* Interactive Bucket Uploader */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Avatar src={avatarUrl} name={displayName || user?.username} size="xl" />
                  {isUploadingAvatar ? (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50">
                      <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute bottom-0 right-0 bg-lime-soft text-black p-1.5 rounded-full shadow-md hover:scale-105 transition-transform z-10">
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
                <span className="text-xs text-white-muted">Tap profile image to upload avatar</span>
              </div>

              <Input
                id="displayNameOnboarding"
                type="text"
                label="Display Name"
                placeholder="Ruchiket"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-white-muted uppercase tracking-wider">
                  Select Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["default", "emerald", "violet"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`py-2 px-3 rounded-button text-xs font-semibold border capitalize transition-all cursor-pointer ${
                        theme === t
                          ? "bg-purple-warm/10 border-purple-warm text-white"
                          : "bg-black-elevated border-white/5 text-white-muted hover:border-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                Save & Continue
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="border border-white/5 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-display font-bold text-xl text-white-off">Accountability Space</h2>
              <p className="text-sm text-white-muted">Create a duo space or join an existing one.</p>
            </div>

            {duoOption === null ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDuoOption("create")}
                  className="flex flex-col items-center justify-center p-6 bg-black-elevated border border-white/5 rounded-card hover:border-lime-soft/40 hover:bg-black-card transition-all cursor-pointer gap-2"
                >
                  <span className="text-2xl">🏗️</span>
                  <span className="font-semibold text-sm">Create Space</span>
                </button>
                <button
                  onClick={() => setDuoOption("join")}
                  className="flex flex-col items-center justify-center p-6 bg-black-elevated border border-white/5 rounded-card hover:border-purple-warm/40 hover:bg-black-card transition-all cursor-pointer gap-2"
                >
                  <span className="text-2xl">🔑</span>
                  <span className="font-semibold text-sm">Join Space</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleDuoSubmit} className="space-y-4">
                {duoOption === "create" ? (
                  <Input
                    id="spaceName"
                    type="text"
                    label="Duo Space Name"
                    placeholder="e.g. Gym Bros"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    required
                  />
                ) : (
                  <Input
                    id="inviteCode"
                    type="text"
                    label="Invite Code"
                    placeholder="e.g. DQ-7F9X"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                  />
                )}

                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setDuoOption(null)}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={isLoading}>
                    {duoOption === "create" ? "Create" : "Join"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
export default OnboardingPage;
