import type { Project } from "@/domain/project";
import {
  completedThisWeekProjects,
  computePortfolioSummary,
  upcomingDueDates,
} from "./portfolio";
import {
  formatReportDate,
  formatReportGeneratedAt,
  toAsOfDate,
  type AsOfInstant,
} from "./reporting-time";

export { weeklyReportFilename } from "./reporting-time";

/**
 * Renders a Markdown weekly status report from the same data the dashboard
 * shows — meant for pasting into Slack/email or handing to people who don't
 * have (or want) a login to the live app.
 *
 * `asOf` defaults to the current instant (browser path). Inject a fixed
 * timestamp for deterministic tests and the secured API endpoint.
 */
export function buildWeeklyReportMarkdown(
  projects: Project[],
  asOf: AsOfInstant = Date.now(),
): string {
  const asOfDate = toAsOfDate(asOf);
  const summary = computePortfolioSummary(projects, asOfDate);
  const upcoming = upcomingDueDates(projects, asOfDate);
  const wins = completedThisWeekProjects(projects, asOfDate);

  const dateStr = formatReportGeneratedAt(asOfDate);

  const lines: string[] = [];
  lines.push("# NIVA Mission Control — Weekly Status");
  lines.push(`_Generated ${dateStr}_`);
  lines.push("");

  lines.push("## Portfolio Summary");
  lines.push(`- Active projects: **${summary.activeProjects}**`);
  lines.push(`- Active status: **${summary.activeStatus}**`);
  lines.push(`- On track: **${summary.onTrack}**`);
  lines.push(`- Not started: **${summary.notStarted}**`);
  lines.push(`- Blocked: **${summary.blocked}**`);
  lines.push(`- Completed this week: **${summary.completedThisWeek}**`);
  lines.push("");

  lines.push("## Upcoming Due Dates");
  if (upcoming.length === 0) {
    lines.push("Nothing due in the near term.");
  } else {
    for (const project of upcoming) {
      lines.push(
        `- **${project.name}** — ${formatReportDate(project.targetCompletion)} (${project.phase})`,
      );
    }
  }
  lines.push("");

  if (wins.length > 0) {
    lines.push("## Completed This Week");
    for (const project of wins) {
      lines.push(
        `- ${project.name} — completed ${formatReportDate(project.completedAt)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
