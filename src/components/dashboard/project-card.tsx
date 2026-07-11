"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, History, EyeOff } from "lucide-react";
import type { Project } from "@/domain/project";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OwnerAvatars } from "@/components/ui/owner-avatars";
import { formatDate, relativeTime, stripMarkdown } from "@/lib/utils";

export function ProjectCard({
  project,
  index = 0,
  onHide,
}: {
  project: Project;
  index?: number;
  onHide?: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
      className="group relative h-full"
    >
      {onHide ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onHide(project.id);
          }}
          title="Hide from view"
          aria-label="Hide from view"
          className="absolute right-2 top-2 z-10 rounded-md border border-border bg-elevated p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <Link href={`/project/${project.id}`} className="block h-full focus:outline-none">
        <Card className="flex h-full flex-col transition-all hover:border-primary/40 hover:shadow-elevated focus-visible:ring-1 focus-visible:ring-ring">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{project.name}</h3>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {project.phase}
              </span>
            </div>
            {project.description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {stripMarkdown(project.description)}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="mt-auto space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium tabular-nums text-foreground">{project.progress}%</span>
              </div>
              <ProgressBar value={project.progress} />
            </div>

            <OwnerAvatars owners={project.owners} />

            <div className="flex items-center justify-between">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {formatDate(project.targetCompletion)}
              </span>
              <span className="flex items-center gap-1">
                <History className="h-3 w-3" />
                {relativeTime(project.lastUpdated)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
