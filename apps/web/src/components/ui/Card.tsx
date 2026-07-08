import React from "react";
import { cn } from "@/lib/utils.ts";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-card rounded-card p-6 shadow-card transition-all duration-300",
          hoverEffect && "hover:border-purple-warm/30 hover:shadow-glow-purple hover:-translate-y-0.5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
export default Card;
