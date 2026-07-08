import React from "react";
import { cn } from "@/lib/utils.ts";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "relative inline-flex items-center justify-center font-semibold rounded-button transition-all duration-200 active:scale-97 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none",
          // Variant mappings
          {
            "bg-lime-soft text-black-deep hover:bg-lime-hover shadow-glow-lime hover:shadow-lg":
              variant === "primary",
            "bg-black-elevated border border-white/10 text-white hover:bg-black-card hover:border-purple-warm/50":
              variant === "secondary",
            "bg-transparent text-white-muted hover:bg-white/5 hover:text-white":
              variant === "ghost",
            "bg-red-accent text-white hover:bg-red-600": variant === "danger",
          },
          // Size mappings
          {
            "px-3 py-1.5 text-xs": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-6 py-3.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
