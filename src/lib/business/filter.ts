import type { Project } from "@/domain/project";
import type { Filters } from "@/components/dashboard/filter-panel";
import type { PortfolioFilterKey } from "@/components/dashboard/portfolio-summary";
import { isActive, isCompletedThisWeek, isOnTrack } from "./portfolio";

function matchesSearch(p: Project, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    p.name,
    p.phase,
    p.status,
    p.priority,
    p.description ?? "",
    ...p.owners.map((o) => o.name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesCompletion(p: Project, bucket: string): boolean {
  switch (bucket) {
    case "lt25":
      return p.progress < 25;
    case "25to75":
      return p.progress >= 25 && p.progress <= 75;
    case "gt75":
      return p.progress > 75 && p.progress < 100;
    case "complete":
      return p.progress >= 100;
    default:
      return true;
  }
}

function matchesPortfolioKey(p: Project, key: PortfolioFilterKey | null): boolean {
  if (!key) return true;
  switch (key) {
    case "active":
      return isActive(p);
    case "onTrack":
      return isOnTrack(p);
    case "notStarted":
      return p.status === "Not Started";
    case "blocked":
      return p.status === "Blocked";
    case "completed":
      return isCompletedThisWeek(p);
  }
}

export function filterProjects(
  projects: Project[],
  opts: {
    query: string;
    filters: Filters;
    portfolioKey: PortfolioFilterKey | null;
    hideCompleted: boolean;
  },
): Project[] {
  const { query, filters, portfolioKey, hideCompleted } = opts;
  // Archived (Completed) cards are hidden by default, but the "Completed This Week"
  // tile and an explicit Completed status filter always reveal them.
  const wantsCompleted = portfolioKey === "completed" || filters.status === "Completed";
  return projects.filter(
    (p) =>
      (!hideCompleted || wantsCompleted || p.status !== "Completed") &&
      matchesSearch(p, query) &&
      matchesPortfolioKey(p, portfolioKey) &&
      (!filters.status || p.status === filters.status) &&
      (!filters.priority || p.priority === filters.priority) &&
      (!filters.phase || p.phase === filters.phase) &&
      (!filters.owner || p.owners.some((o) => o.id === filters.owner)) &&
      matchesCompletion(p, filters.completion),
  );
}
