"use client";

import { SearchX } from "lucide-react";
import type { Project } from "@/domain/project";
import { ProjectCard } from "./project-card";
import { EmptyState } from "@/components/ui/empty-state";

export function ProjectGrid({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title="No initiatives match"
        message="Adjust your search or filters to see projects in the portfolio."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((p, i) => (
        <ProjectCard key={p.id} project={p} index={i} />
      ))}
    </div>
  );
}
