"use client";

import { Activity, CheckCircle2, Clock, Ban, TrendingUp } from "lucide-react";
import type { Project } from "@/domain/project";
import { computePortfolioSummary } from "@/lib/business/portfolio";
import { MetricCard } from "./metric-card";

export type PortfolioFilterKey = "active" | "onTrack" | "pending" | "blocked" | "completed";

export function PortfolioSummary({
  projects,
  activeKey,
  onSelect,
}: {
  projects: Project[];
  activeKey: PortfolioFilterKey | null;
  onSelect: (key: PortfolioFilterKey) => void;
}) {
  const s = computePortfolioSummary(projects);
  const cards = [
    { key: "active" as const, label: "Active Projects", value: s.activeProjects, icon: Activity, tone: "blue" as const },
    { key: "onTrack" as const, label: "On Track", value: s.onTrack, icon: TrendingUp, tone: "green" as const },
    { key: "pending" as const, label: "Pending", value: s.pending, icon: Clock, tone: "gold" as const },
    { key: "blocked" as const, label: "Blocked", value: s.blocked, icon: Ban, tone: "orange" as const },
    { key: "completed" as const, label: "Completed This Week", value: s.completedThisWeek, icon: CheckCircle2, tone: "green" as const },
  ];
  return (
    <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <MetricCard
          key={c.key}
          label={c.label}
          value={c.value}
          icon={c.icon}
          tone={c.tone}
          active={activeKey === c.key}
          onClick={() => onSelect(c.key)}
        />
      ))}
    </section>
  );
}
