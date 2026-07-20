import { describe, expect, it } from "vitest";
import type { Project } from "@/domain/project";
import {
  completedThisWeekProjects,
  computePortfolioSummary,
  isActive,
  isActiveStatus,
  isCompletedThisWeek,
  isOnTrack,
} from "@/lib/business/portfolio";
import {
  easternCalendarDate,
  startOfReportingWeek,
  zonedLocalToUtc,
} from "@/lib/business/reporting-time";

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

/** Sunday 10:00 PM America/New_York on 2026-07-19 (EDT, UTC-4). */
const SUNDAY_EVENING_ET = new Date("2026-07-19T22:00:00-04:00");

describe("America/New_York reporting week", () => {
  it("starts Monday 00:00:00 Eastern for a Sunday asOf", () => {
    const start = startOfReportingWeek(SUNDAY_EVENING_ET);
    expect(start.toISOString()).toBe(
      zonedLocalToUtc(2026, 7, 13, 0, 0, 0).toISOString(),
    );
    expect(easternCalendarDate(start)).toBe("2026-07-13");
  });

  it("includes completions at Monday midnight Eastern", () => {
    const mondayStart = startOfReportingWeek(SUNDAY_EVENING_ET);
    const p = project({
      id: "monday",
      name: "Monday Win",
      status: "Completed",
      completedAt: mondayStart.toISOString(),
    });
    expect(isCompletedThisWeek(p, SUNDAY_EVENING_ET)).toBe(true);
  });

  it("excludes completions just before Monday midnight Eastern", () => {
    const mondayStart = startOfReportingWeek(SUNDAY_EVENING_ET);
    const p = project({
      id: "before",
      name: "Previous Week",
      status: "Completed",
      completedAt: new Date(mondayStart.getTime() - 1).toISOString(),
      lastUpdated: SUNDAY_EVENING_ET.toISOString(),
    });
    expect(isCompletedThisWeek(p, SUNDAY_EVENING_ET)).toBe(false);
  });

  it("handles a week that spans the spring-forward DST transition", () => {
    // 2026-03-08 02:00 ET springs forward; week Mon 2026-03-02 .. asOf Sun 2026-03-08 22:00 ET
    const asOf = new Date("2026-03-08T22:00:00-04:00");
    const start = startOfReportingWeek(asOf);
    expect(start.toISOString()).toBe(
      zonedLocalToUtc(2026, 3, 2, 0, 0, 0).toISOString(),
    );
    // Duration is not 7×24h because of the lost spring-forward hour.
    const durationHours = (asOf.getTime() - start.getTime()) / (60 * 60 * 1000);
    expect(durationHours).toBe(165); // Mon 00:00 EST → Sun 22:00 EDT
  });

  it("handles fall-back DST when locating Monday midnight", () => {
    // 2026-11-01 02:00 ET falls back; week Mon 2026-10-26
    const asOf = new Date("2026-11-01T22:00:00-05:00");
    const start = startOfReportingWeek(asOf);
    expect(start.toISOString()).toBe(
      zonedLocalToUtc(2026, 10, 26, 0, 0, 0).toISOString(),
    );
  });
});

describe("completion semantics", () => {
  it("counts and lists a project completed during the current Eastern week", () => {
    const p = project({
      id: "done",
      name: "Shipped",
      status: "Completed",
      completedAt: "2026-07-15T15:00:00-04:00",
      lastUpdated: "2026-07-15T15:00:00-04:00",
    });
    const summary = computePortfolioSummary([p], SUNDAY_EVENING_ET);
    const list = completedThisWeekProjects([p], SUNDAY_EVENING_ET);
    expect(summary.completedThisWeek).toBe(1);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("done");
  });

  it("excludes a historical completion that was only edited this week", () => {
    const p = project({
      id: "old",
      name: "Old Win",
      status: "Completed",
      completedAt: "2026-06-01T12:00:00-04:00",
      lastUpdated: "2026-07-18T12:00:00-04:00",
    });
    expect(isCompletedThisWeek(p, SUNDAY_EVENING_ET)).toBe(false);
    expect(computePortfolioSummary([p], SUNDAY_EVENING_ET).completedThisWeek).toBe(0);
    expect(completedThisWeekProjects([p], SUNDAY_EVENING_ET)).toHaveLength(0);
  });

  it("excludes completed projects with completedAt: null", () => {
    const p = project({
      id: "backfill",
      name: "Backfill",
      status: "Completed",
      completedAt: null,
      lastUpdated: "2026-07-18T12:00:00-04:00",
    });
    expect(isCompletedThisWeek(p, SUNDAY_EVENING_ET)).toBe(false);
    expect(computePortfolioSummary([p], SUNDAY_EVENING_ET).completedThisWeek).toBe(0);
    expect(completedThisWeekProjects([p], SUNDAY_EVENING_ET)).toHaveLength(0);
  });

  it("excludes completions after asOf from summary count and detailed list", () => {
    const p = project({
      id: "after",
      name: "After Cutoff",
      status: "Completed",
      completedAt: "2026-07-19T23:00:00-04:00",
      lastUpdated: "2026-07-19T23:00:00-04:00",
    });
    expect(new Date(p.completedAt!).getTime()).toBeGreaterThan(SUNDAY_EVENING_ET.getTime());
    expect(isCompletedThisWeek(p, SUNDAY_EVENING_ET)).toBe(false);
    expect(computePortfolioSummary([p], SUNDAY_EVENING_ET).completedThisWeek).toBe(0);
    expect(completedThisWeekProjects([p], SUNDAY_EVENING_ET)).toHaveLength(0);
  });

  it("keeps summary completion count equal to detailed list length", () => {
    const projects = [
      project({
        id: "a",
        name: "A",
        status: "Completed",
        completedAt: "2026-07-14T10:00:00-04:00",
      }),
      project({
        id: "b",
        name: "B",
        status: "Completed",
        completedAt: "2026-07-16T10:00:00-04:00",
      }),
      project({
        id: "c",
        name: "C",
        status: "Completed",
        completedAt: "2026-07-01T10:00:00-04:00",
        lastUpdated: "2026-07-18T10:00:00-04:00",
      }),
      project({
        id: "d",
        name: "D",
        status: "Completed",
        completedAt: null,
        lastUpdated: "2026-07-18T10:00:00-04:00",
      }),
    ];
    const summary = computePortfolioSummary(projects, SUNDAY_EVENING_ET);
    const list = completedThisWeekProjects(projects, SUNDAY_EVENING_ET);
    expect(summary.completedThisWeek).toBe(list.length);
    expect(list.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
});

describe("status composition partition", () => {
  const projects = [
    project({
      id: "active-ok",
      name: "Active OK",
      status: "Active",
      targetCompletion: "2026-08-01",
    }),
    project({
      id: "active-late",
      name: "Active Late",
      status: "Active",
      targetCompletion: "2026-07-01",
    }),
    project({ id: "blocked", name: "Blocked", status: "Blocked" }),
    project({
      id: "ns",
      name: "Not Started",
      status: "Not Started",
      targetCompletion: "2026-08-15",
    }),
    project({
      id: "done",
      name: "Done",
      status: "Completed",
      completedAt: "2026-07-15T12:00:00-04:00",
    }),
  ];

  it("exposes exact Active / Blocked / Not Started counts and the active total", () => {
    const summary = computePortfolioSummary(projects, SUNDAY_EVENING_ET);
    expect(summary.activeStatus).toBe(2);
    expect(summary.blocked).toBe(1);
    expect(summary.notStarted).toBe(1);
    expect(summary.activeProjects).toBe(4);
  });

  it("holds the status partition invariant", () => {
    const active = projects.filter(isActive);
    const activeStatus = projects.filter(isActiveStatus);
    const blocked = projects.filter((p) => p.status === "Blocked");
    const notStarted = projects.filter((p) => p.status === "Not Started");
    expect(active.length).toBe(
      activeStatus.length + blocked.length + notStarted.length,
    );
    const summary = computePortfolioSummary(projects, SUNDAY_EVENING_ET);
    expect(summary.activeProjects).toBe(
      summary.activeStatus + summary.blocked + summary.notStarted,
    );
  });

  it("keeps On Track as a separate health metric", () => {
    const summary = computePortfolioSummary(projects, SUNDAY_EVENING_ET);
    // Active OK + Not Started (not past due, not blocked) = 2; past-due Active is not on track
    expect(summary.onTrack).toBe(2);
    expect(isOnTrack(projects.find((p) => p.id === "active-late")!, SUNDAY_EVENING_ET)).toBe(
      false,
    );
    expect(isOnTrack(projects.find((p) => p.id === "active-ok")!, SUNDAY_EVENING_ET)).toBe(true);
    // On Track is not a status enum bucket — membership differs from Active status.
    expect(isOnTrack(projects.find((p) => p.id === "ns")!, SUNDAY_EVENING_ET)).toBe(true);
    expect(isActiveStatus(projects.find((p) => p.id === "ns")!)).toBe(false);
  });

  it("keeps past-due Active projects in Active status without counting them On Track", () => {
    const late = projects.find((p) => p.id === "active-late")!;
    expect(isActiveStatus(late)).toBe(true);
    expect(isOnTrack(late, SUNDAY_EVENING_ET)).toBe(false);
  });

  it("documents Not Started as a status bucket only (may also be On Track)", () => {
    const ns = projects.find((p) => p.id === "ns")!;
    expect(ns.status).toBe("Not Started");
    expect(isActiveStatus(ns)).toBe(false);
    expect(isOnTrack(ns, SUNDAY_EVENING_ET)).toBe(true);
    const summary = computePortfolioSummary(projects, SUNDAY_EVENING_ET);
    // Not Started contributes to notStarted and possibly onTrack, but never to activeStatus
    expect(summary.notStarted).toBe(1);
    expect(summary.activeStatus).toBe(2);
  });
});
