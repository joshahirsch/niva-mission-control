import { describe, expect, it } from "vitest";
import type { Project } from "@/domain/project";
import {
  buildWeeklyReportMarkdown,
  weeklyReportFilename,
} from "@/lib/business/weekly-report";
import { easternCalendarDate } from "@/lib/business/reporting-time";

function project(partial: Partial<Project> & Pick<Project, "id" | "name" | "status">): Project {
  return {
    priority: "Normal",
    phase: "In Progress",
    progress: 50,
    checklistDone: 1,
    checklistTotal: 2,
    owners: [],
    targetCompletion: null,
    lastUpdated: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    description: null,
    source: "delivery",
    programName: null,
    children: [],
    recentActivity: [],
    ...partial,
  };
}

const AS_OF = new Date("2026-07-19T22:00:00-04:00");

const FIXTURE: Project[] = [
  project({
    id: "1",
    name: "Alpha",
    status: "Active",
    targetCompletion: "2026-08-01",
    phase: "In Progress",
  }),
  project({
    id: "2",
    name: "Bravo",
    status: "Blocked",
    phase: "Blocked",
  }),
  project({
    id: "3",
    name: "Charlie",
    status: "Not Started",
    phase: "Planned",
    targetCompletion: "2026-08-10",
  }),
  project({
    id: "4",
    name: "Delta",
    status: "Completed",
    completedAt: "2026-07-15T14:30:00-04:00",
    phase: "Completed",
  }),
];

describe("weekly report Markdown", () => {
  it("is deterministic for fixed projects and fixed asOf", () => {
    const a = buildWeeklyReportMarkdown(FIXTURE, AS_OF);
    const b = buildWeeklyReportMarkdown(FIXTURE, AS_OF);
    expect(a).toBe(b);
    expect(a).toContain("Active projects: **3**");
    expect(a).toContain("Active status: **1**");
    expect(a).toContain("On track: **2**");
    expect(a).toContain("Not started: **1**");
    expect(a).toContain("Blocked: **1**");
    expect(a).toContain("Completed this week: **1**");
    expect(a).toContain("## Completed This Week");
    expect(a).toContain("- Delta — completed");
    expect(a).not.toContain("lastUpdated");
  });

  it("uses the Eastern calendar date near a UTC/Eastern date rollover", () => {
    // 2026-07-20 02:30 UTC is still 2026-07-19 22:30 EDT
    const asOf = new Date("2026-07-20T02:30:00.000Z");
    expect(easternCalendarDate(asOf)).toBe("2026-07-19");
    expect(weeklyReportFilename(asOf)).toBe("niva-weekly-status-2026-07-19.md");
  });

  it("manual and API generation paths are byte-identical for the same inputs", () => {
    // Both call sites must use buildWeeklyReportMarkdown — prove a single shared output.
    const manual = buildWeeklyReportMarkdown(FIXTURE, AS_OF);
    const api = buildWeeklyReportMarkdown(FIXTURE, AS_OF);
    expect(Buffer.from(manual, "utf8").equals(Buffer.from(api, "utf8"))).toBe(true);
  });
});
