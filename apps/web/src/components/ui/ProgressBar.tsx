import { cn } from "@/lib/utils.ts";

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: "lime" | "purple" | "blue" | "green" | "orange" | "rose";
  className?: string;
  showText?: boolean;
}

export function ProgressBar({ value, color = "lime", className, showText = false }: ProgressBarProps) {
  const percentage = Math.min(Math.max(value, 0), 100);

  const colorClasses = {
    lime: "bg-lime-soft shadow-glow-lime",
    purple: "bg-purple-warm shadow-glow-purple",
    blue: "bg-blue-accent",
    green: "bg-green-accent",
    orange: "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
    rose: "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]",
  };

  return (
    <div className={cn("w-full space-y-1 text-left", className)}>
      <div className="flex items-center justify-between text-xs font-semibold text-white-muted">
        {showText && <span>Progress</span>}
        {showText && <span>{percentage}%</span>}
      </div>
      <div className="w-full h-3 bg-black-elevated border border-white/5 rounded-pill overflow-hidden">
        <div
          className={cn("h-full rounded-pill transition-all duration-500 ease-out", colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
export default ProgressBar;
