import type { PortfolioSummary, Project } from "@/domain/project";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "On track": actively progressing and not blocked or overdue. */
export function isOnTrack(p: Project, now = Date.now()): boolean {
  if (p.status === "Blocked") return false;
  if (p.status === "Completed") return false;
  if (isPastDue(p, now)) return false;
  return true;
}

export function isPastDue(p: Project, now = Date.now()): boolean {
  if (p.status === "Completed" || !p.targetCompletion) return false;
  return new Date(p.targetCompletion).getTime() < now;
}

export function isActive(p: Project): boolean {
  return p.status !== "Completed";
}

export function computePortfolioSummary(projects: Project[], now = Date.now()): PortfolioSummary {
  return {
    activeProjects: projects.filter(isActive).length,
    onTrack: projects.filter((p) => isOnTrack(p, now)).length,
    pending: projects.filter((p) => p.status === "Pending").length,
    blocked: projects.filter((p) => p.status === "Blocked").length,
    completedThisWeek: projects.filter(
      (p) => p.status === "Completed" && now - new Date(p.lastUpdated).getTime() <= ONE_WEEK_MS,
    ).length,
  };
}
