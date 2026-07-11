import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        green: "border-status-green/25 bg-status-green/10 text-status-green",
        gold: "border-status-gold/25 bg-status-gold/10 text-status-gold",
        orange: "border-status-orange/25 bg-status-orange/10 text-status-orange",
        gray: "border-status-gray/25 bg-status-gray/10 text-status-gray",
        blue: "border-primary/25 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
export { badgeVariants };
