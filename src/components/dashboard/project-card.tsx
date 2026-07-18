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
import { PipelineStepper } from "@/components/ui/pipeline-stepper";
import { isPastDue as computeIsPastDue } from "@/lib/business/portfolio";
import { cn, dueLabel, formatDate, progressLabel, relativeTime, stripMarkdown } from "@/lib/utils";

export function ProjectCard({
  project,
  index = 0,
  onHide,
}: {
  project: Project;
  index?: number;
  onHide?: (id: string) => void;
}) {
  const pastDue = computeIsPastDue(project);
  const due = dueLabel(project.targetCompletion);
  const dueTone = pastDue
    ? "text-status-orange"
    : due.startsWith("Due in") && Number(due.replace(/\D+/g, "")) <= 7
      ? "text-status-gold"
      : "text-muted-foreground";

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
          className="absolute right-2 top-2 z-10 rounded-md border border-border bg-elevated/90 p-1 text-muted-foreground opacity-60 transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 print:hidden"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <Link href={`/project/${project.id}`} className="block h-full focus:outline-none">
        <Card className="flex h-full flex-col transition-all hover:border-primary/40 hover:shadow-elevated focus-visible:ring-1 focus-visible:ring-ring">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{project.name}</h3>
              <PriorityBadge priority={project.priority} />
            </div>
            {project.description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {stripMarkdown(project.description)}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="mt-auto space-y-4">
            {/* Pipeline position — the primary "where are we" signal for ELT. */}
            <PipelineStepper phase={project.phase} status={project.status} isPastDue={pastDue} />

            {/* Timeline: target date is the headline; progress % is supporting detail. */}
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-elevated/50 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <CalendarClock className={cn("h-3.5 w-3.5", dueTone)} />
                <div className="leading-tight">
                  <div className={cn("text-xs font-semibold", dueTone)}>{due}</div>
                  <div className="text-[10px] text-muted-foreground">Target {formatDate(project.targetCompletion)}</div>
                </div>
              </div>
              <div className="text-right leading-tight">
                <div className="text-xs font-medium tabular-nums text-foreground">{project.progress}%</div>
                <div className="text-[10px] text-muted-foreground">
                  {progressLabel(project.checklistDone, project.checklistTotal)}
                </div>
              </div>
            </div>
            <ProgressBar value={project.progress} inferred={project.checklistTotal === 0} />

            <div className="flex items-center justify-between">
              <OwnerAvatars owners={project.owners} />
              <StatusBadge status={project.status} />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <History className="h-3 w-3" />
                Updated {relativeTime(project.lastUpdated)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
