import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import Avatar from "@/components/ui/Avatar.tsx";
import { Zap } from "lucide-react";

export function Header() {
  const { user } = useAuthStore();
  const { activeDuoSpace } = useDuoSpaceStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 w-full glass-nav border-b border-white/5 h-14 flex items-center justify-between px-4">
      {/* Brand Logo / Space Name */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
        <div className="bg-gradient-to-br from-lime-soft to-purple-warm w-7 h-7 rounded-lg flex items-center justify-center font-display font-extrabold text-sm text-black">
          DQ
        </div>
        <span className="font-display font-bold text-sm tracking-tight text-white-off">
          {activeDuoSpace ? activeDuoSpace.name : "DuoQuest"}
        </span>
      </div>

      {/* Level and Avatar Widget */}
      {user && (
        <div className="flex items-center gap-3">
          {/* XP Widget */}
          <div
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1 bg-black-elevated border border-white/5 px-2.5 py-1 rounded-pill cursor-pointer hover:border-purple-warm/30 transition-all text-xs font-semibold text-lime-soft"
          >
            <Zap className="w-3.5 h-3.5 fill-lime-soft text-lime-soft animate-pulse" />
            <span>Lvl {user.level}</span>
          </div>

          {/* User Avatar */}
          <div onClick={() => navigate("/profile")} className="cursor-pointer">
            <Avatar src={user.avatarUrl} name={user.username} size="sm" />
          </div>
        </div>
      )}
    </header>
  );
}
export default Header;
    
