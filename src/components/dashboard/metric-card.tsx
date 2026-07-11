"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "text-foreground",
  green: "text-status-green",
  gold: "text-status-gold",
  orange: "text-status-orange",
  gray: "text-status-gray",
  blue: "text-primary",
} as const;

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: keyof typeof TONE;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "transition-all",
        clickable && "cursor-pointer hover:border-primary/40 hover:bg-elevated",
        active && "border-primary/60 ring-1 ring-primary/40",
      )}
    >
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-3xl font-semibold tabular-nums", TONE[tone])}>{value}</p>
        </div>
        <Icon className={cn("h-4 w-4", TONE[tone])} />
      </CardContent>
    </Card>
  );
}
