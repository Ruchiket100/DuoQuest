import { cn } from "@/lib/utils.ts";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  online?: boolean;
}

export function Avatar({ src, name = "?", size = "md", className, online }: AvatarProps) {
  const initials = name.substring(0, 2).toUpperCase();

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-3xl",
  };

  return (
    <div className={cn("relative inline-block select-none", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full overflow-hidden border border-white/10 font-bold bg-gradient-to-br from-purple-deep to-black-card text-white-off shrink-0",
          sizeClasses[size]
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-black-deep",
            {
              "w-2.5 h-2.5 bg-green-accent": online,
              "w-2.5 h-2.5 bg-white-muted/40": !online,
              "w-3.5 h-3.5": size === "lg" || size === "xl",
            }
          )}
        />
      )}
    </div>
  );
}
export default Avatar;
