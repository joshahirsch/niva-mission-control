import type { PortfolioSummary, Project } from "@/domain/project";
import {
  startOfReportingWeek,
  toAsOfDate,
  type AsOfInstant,
} from "./reporting-time";

/** "On track": actively progressing and not blocked or overdue. Health metric — not a status partition bucket. */
export function isOnTrack(p: Project, asOf: AsOfInstant = Date.now()): boolean {
  if (p.status === "Blocked") return false;
  if (p.status === "Completed") return false;
  if (isPastDue(p, asOf)) return false;
  return true;
}

export function isPastDue(p: Project, asOf: AsOfInstant = Date.now()): boolean {
  if (p.status === "Completed" || !p.targetCompletion) return false;
  return new Date(p.targetCompletion).getTime() < toAsOfDate(asOf).getTime();
}

/** Non-completed projects (Active + Blocked + Not Started). */
export function isActive(p: Project): boolean {
  return p.status !== "Completed";
}

export function isActiveStatus(p: Project): boolean {
  return p.status === "Active";
}

/**
 * Completed during the current America/New_York reporting week:
 * Monday 12:00:00 AM Eastern through `asOf` (inclusive), keyed by `completedAt`.
 */
export function isCompletedThisWeek(
  p: Project,
  asOf: AsOfInstant = Date.now(),
): boolean {
  if (p.status !== "Completed" || p.completedAt === null) return false;
  const completedMs = new Date(p.completedAt).getTime();
  if (Number.isNaN(completedMs)) return false;
  const asOfDate = toAsOfDate(asOf);
  const weekStartMs = startOfReportingWeek(asOfDate).getTime();
  const asOfMs = asOfDate.getTime();
  return completedMs >= weekStartMs && completedMs <= asOfMs;
}

/**
 * Projects completed this reporting week, most recent `completedAt` first.
 * Same membership rule as `computePortfolioSummary.completedThisWeek`.
 */
export function completedThisWeekProjects(
  projects: Project[],
  asOf: AsOfInstant = Date.now(),
): Project[] {
  return projects
    .filter((p) => isCompletedThisWeek(p, asOf))
    .sort(
      (a, b) =>
        new Date(b.completedAt as string).getTime() -
        new Date(a.completedAt as string).getTime(),
    );
}

/** @deprecated Use completedThisWeekProjects — kept as a named alias for call-site clarity. */
export const recentlyCompleted = completedThisWeekProjects;

export function computePortfolioSummary(
  projects: Project[],
  asOf: AsOfInstant = Date.now(),
): PortfolioSummary {
  const activeProjects = projects.filter(isActive);
  const activeStatusProjects = projects.filter(isActiveStatus);
  const blockedProjects = projects.filter((p) => p.status === "Blocked");
  const notStartedProjects = projects.filter((p) => p.status === "Not Started");
  const completed = completedThisWeekProjects(projects, asOf);

  return {
    activeProjects: activeProjects.length,
    activeStatus: activeStatusProjects.length,
    onTrack: projects.filter((p) => isOnTrack(p, asOf)).length,
    notStarted: notStartedProjects.length,
    blocked: blockedProjects.length,
    completedThisWeek: completed.length,
  };
}

/**
 * Active projects with a target date from `asOf` forward, soonest first. Past-due
 * projects are excluded here (that's visible per-card via the due-date coloring
 * on the project grid) — this list stays focused on "what's coming."
 */
export function upcomingDueDates(
  projects: Project[],
  asOf: AsOfInstant = Date.now(),
  limit = 8,
): Project[] {
  const asOfMs = toAsOfDate(asOf).getTime();
  return projects
    .filter((p) => p.status !== "Completed" && p.targetCompletion)
    .filter((p) => new Date(p.targetCompletion as string).getTime() >= asOfMs)
    .sort(
      (a, b) =>
        new Date(a.targetCompletion as string).getTime() -
        new Date(b.targetCompletion as string).getTime(),
    )
    .slice(0, limit);
}
