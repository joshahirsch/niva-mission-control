"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, History } from "lucide-react";
import type { ReactNode } from "react";
import type { Project } from "@/domain/project";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OwnerAvatars } from "@/components/ui/owner-avatars";
import { formatDate, relativeTime } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function ProjectDetail({ project }: { project: Project }) {
  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mission Control
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{project.phase}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
      </header>

      {/* Fact strip */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Owner">
            <OwnerAvatars owners={project.owners} />
          </Fact>
          <Fact label="Current Phase">{project.phase}</Fact>
          <Fact label="Progress">
            <div className="space-y-1.5">
              <span className="tabular-nums">{project.progress}%</span>
              <ProgressBar value={project.progress} />
            </div>
          </Fact>
          <Fact label="Target Completion">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDate(project.targetCompletion)}
            </span>
          </Fact>
          <Fact label="Last Updated">
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              {relativeTime(project.lastUpdated)}
            </span>
          </Fact>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
              {project.description ? (
                <Markdown content={project.description} />
              ) : (
                <p className="text-sm text-muted-foreground">No description on this card.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Activity
              </h3>
              {project.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <ol className="space-y-4">
                  {project.recentActivity.map((a) => (
                    <li key={a.id} className="relative border-l border-border pl-4">
                      <span className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-sm text-foreground/90">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground">{relativeTime(a.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
