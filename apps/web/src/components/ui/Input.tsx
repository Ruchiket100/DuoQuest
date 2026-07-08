import React from "react";
import { cn } from "@/lib/utils.ts";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold text-white-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "w-full bg-black-elevated border border-white/5 rounded-button px-4 py-3 text-sm text-white placeholder-white-muted/40 focus:border-purple-warm/50 focus:ring-1 focus:ring-purple-warm/50 transition-all duration-200",
            error && "border-red-accent/50 focus:border-red-accent focus:ring-red-accent/50",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-accent block pl-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
