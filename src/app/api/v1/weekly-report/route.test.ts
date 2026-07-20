import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/domain/project";
import { buildWeeklyReportMarkdown } from "@/lib/business/weekly-report";

const getProjects = vi.fn();

vi.mock("@/lib/repository", () => ({
  getRepository: () => ({ getProjects }),
}));

import { GET } from "@/app/api/v1/weekly-report/route";
import * as weeklyReportRoute from "@/app/api/v1/weekly-report/route";

const TOKEN = "weekly-report-test-token-0000001";

const sampleProject: Project = {
  id: "p1",
  name: "Sample",
  status: "Active",
  priority: "High",
  phase: "In Progress",
  progress: 50,
  checklistDone: 1,
  checklistTotal: 2,
  owners: [
    {
      id: "o1",
      name: "Ada",
      initials: "A",
      avatarUrl: "https://example.com/avatar.png",
    },
  ],
  targetCompletion: "2026-08-01",
  lastUpdated: "2026-07-19T12:00:00.000Z",
  completedAt: null,
  description: "A summary",
  source: "delivery",
  programName: null,
  children: [],
  recentActivity: [{ id: "a1", text: "Moved to In Progress", at: "2026-07-18T10:00:00.000Z" }],
};

function requestWithAuth(
  authorization?: string,
  url = "http://localhost/api/v1/weekly-report",
): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request(url, { headers });
}

describe("GET /api/v1/weekly-report", () => {
  beforeEach(() => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    getProjects.mockReset();
    getProjects.mockResolvedValue([sampleProject]);
  });

  afterEach(() => {
    delete process.env.MISSION_CONTROL_API_TOKEN;
  });

  it("returns 401 and never invokes the repository when Authorization is missing", async () => {
    const res = await GET(requestWithAuth());
    expect(res.status).toBe(401);
    expect(getProjects).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("returns 401 for a wrong token without invoking the repository", async () => {
    const res = await GET(requestWithAuth(`Bearer ${"x".repeat(TOKEN.length)}`));
    expect(res.status).toBe(401);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("fails closed with 500 when the server token is missing", async () => {
    delete process.env.MISSION_CONTROL_API_TOKEN;
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    expect(res.status).toBe(500);
    expect(getProjects).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("fails closed with 500 when the server token is too short", async () => {
    process.env.MISSION_CONTROL_API_TOKEN = "too-short";
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    expect(res.status).toBe(500);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("sets Cache-Control: no-store on unauthorized responses", async () => {
    const res = await GET(requestWithAuth());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("does not accept credentials from query parameters or cookies", async () => {
    const url = `http://localhost/api/v1/weekly-report?token=${TOKEN}`;
    const res = await GET(
      new Request(url, {
        headers: { cookie: `MISSION_CONTROL_API_TOKEN=${TOKEN}` },
      }),
    );
    expect(res.status).toBe(401);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("only exports GET", () => {
    expect(weeklyReportRoute.GET).toBeTypeOf("function");
    expect("POST" in weeklyReportRoute && weeklyReportRoute.POST).toBeFalsy();
  });

  it("returns 200 Markdown with no-store and Eastern Content-Disposition", async () => {
    const asOf = "2026-07-19T22:00:00-04:00";
    const res = await GET(
      requestWithAuth(
        `Bearer ${TOKEN}`,
        `http://localhost/api/v1/weekly-report?asOf=${encodeURIComponent(asOf)}`,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="niva-weekly-status-2026-07-19.md"',
    );
    const text = await res.text();
    expect(text).toBe(buildWeeklyReportMarkdown([sampleProject], new Date(asOf)));
    expect(text).toContain("# NIVA Mission Control — Weekly Status");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("avatarUrl");
  });

  it("rejects invalid asOf with 400 without calling the repository", async () => {
    const res = await GET(
      requestWithAuth(
        `Bearer ${TOKEN}`,
        "http://localhost/api/v1/weekly-report?asOf=not-a-timestamp",
      ),
    );
    expect(res.status).toBe(400);
    expect(getProjects).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ error: "Invalid asOf" });
  });

  it("rejects date-only asOf with 400", async () => {
    const res = await GET(
      requestWithAuth(
        `Bearer ${TOKEN}`,
        "http://localhost/api/v1/weekly-report?asOf=2026-07-19",
      ),
    );
    expect(res.status).toBe(400);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("rejects timezone-naive asOf with 400", async () => {
    const res = await GET(
      requestWithAuth(
        `Bearer ${TOKEN}`,
        "http://localhost/api/v1/weekly-report?asOf=2026-07-19T22:00:00",
      ),
    );
    expect(res.status).toBe(400);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar asOf with sanitized 400 and does not fall back to now", async () => {
    const impossible = "2026-02-30T12:00:00Z";
    // JS Date would normalize this; the route must reject instead of using "now" or Mar 2.
    expect(new Date(impossible).toISOString()).toBe("2026-03-02T12:00:00.000Z");

    const res = await GET(
      requestWithAuth(
        `Bearer ${TOKEN}`,
        `http://localhost/api/v1/weekly-report?asOf=${encodeURIComponent(impossible)}`,
      ),
    );
    expect(res.status).toBe(400);
    expect(getProjects).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid asOf" });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(body)).not.toContain("2026-03-02");
    expect(res.headers.get("Content-Disposition")).toBeNull();
  });

  it("returns a sanitized 502 when the repository fails", async () => {
    getProjects.mockRejectedValue(new Error("Trello secret leaked in message"));
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ error: "Bad gateway" });
    expect(JSON.stringify(body)).not.toContain("Trello");
    expect(JSON.stringify(body)).not.toContain("leaked");
  });
});
