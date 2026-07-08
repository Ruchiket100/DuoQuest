import React from "react";
import { cn } from "@/lib/utils.ts";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "gold" | "info" | "outline";
}

export function Badge({ className, variant = "primary", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-semibold select-none",
        {
          "bg-lime-soft/10 text-lime-soft border border-lime-soft/20": variant === "primary",
          "bg-purple-warm/10 text-purple-warm border border-purple-warm/20": variant === "secondary",
          "bg-green-accent/10 text-green-accent border border-green-accent/20": variant === "success",
          "bg-gold/10 text-gold border border-gold/20": variant === "gold",
          "bg-blue-accent/10 text-blue-accent border border-blue-accent/20": variant === "info",
          "border border-white/10 text-white-muted": variant === "outline",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
export default Badge;
