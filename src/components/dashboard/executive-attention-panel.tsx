"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { Project } from "@/domain/project";
import { computeExecutiveAttention } from "@/lib/business/attention";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { OwnerAvatars } from "@/components/ui/owner-avatars";

export function ExecutiveAttentionPanel({ projects }: { projects: Project[] }) {
  const items = computeExecutiveAttention(projects);
  if (items.length === 0) return null;

  return (
    <section aria-label="Executive attention" className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-status-orange" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Requires Executive Attention</h2>
        <span className="rounded-full bg-status-orange/10 px-2 py-0.5 text-xs font-medium text-status-orange">
          {items.length}
        </span>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {/* Header row (desktop) */}
        <div className="hidden grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span className="col-span-4">Project</span>
          <span className="col-span-3">Owner</span>
          <span className="col-span-2">Phase</span>
          <span className="col-span-2">Reason</span>
          <span className="col-span-1 text-right">Status</span>
        </div>

        {items.map(({ project, reasons }) => (
          <Link
            key={project.id}
            href={`/project/${project.id}`}
            className="group grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-elevated md:grid-cols-12 md:items-center md:gap-4"
          >
            <div className="col-span-4 flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{project.name}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:hidden" />
            </div>
            <div className="col-span-3">
              <OwnerAvatars owners={project.owners} />
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">{project.phase}</div>
            <div className="col-span-2 flex flex-wrap gap-1">
              {reasons.map((r) => (
                <Badge key={r} tone="orange">
                  {r}
                </Badge>
              ))}
            </div>
            <div className="col-span-1 flex md:justify-end">
              <StatusBadge status={project.status} />
            </div>
          </Link>
        ))}
      </Card>
    </section>
  );
}
