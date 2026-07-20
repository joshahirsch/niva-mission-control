import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/domain/project";

const getProjects = vi.fn();

vi.mock("@/lib/repository", () => ({
  getRepository: () => ({ getProjects }),
}));

import { GET } from "@/app/api/v1/delivery/route";
import * as deliveryRoute from "@/app/api/v1/delivery/route";

const TOKEN = "delivery-route-test-token-00000001";

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

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/v1/delivery", { headers });
}

describe("GET /api/v1/delivery", () => {
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
  });

  it("returns 401 for a malformed Authorization header without invoking the repository", async () => {
    const res = await GET(requestWithAuth("NotBearer stuff"));
    expect(res.status).toBe(401);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong token without invoking the repository", async () => {
    const res = await GET(requestWithAuth(`Bearer ${"x".repeat(TOKEN.length)}`));
    expect(res.status).toBe(401);
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("sets Cache-Control: no-store on unauthorized responses", async () => {
    const res = await GET(requestWithAuth());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("sets Cache-Control: no-store on misconfigured responses", async () => {
    process.env.MISSION_CONTROL_API_TOKEN = "too-short";
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("only exports GET — unsupported methods are not implemented", () => {
    expect(deliveryRoute.GET).toBeTypeOf("function");
    expect("POST" in deliveryRoute && deliveryRoute.POST).toBeFalsy();
    expect("PUT" in deliveryRoute && deliveryRoute.PUT).toBeFalsy();
    expect("DELETE" in deliveryRoute && deliveryRoute.DELETE).toBeFalsy();
    expect("PATCH" in deliveryRoute && deliveryRoute.PATCH).toBeFalsy();
  });

  it("does not accept credentials from query parameters or cookies", async () => {
    const url = `http://localhost/api/v1/delivery?token=${TOKEN}`;
    const res = await GET(
      new Request(url, {
        headers: { cookie: `MISSION_CONTROL_API_TOKEN=${TOKEN}` },
      }),
    );
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
  });

  it("returns authorized delivery JSON for the correct token", async () => {
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getProjects).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.source).toBe("mission-control");
    expect(body.view).toBe("delivery");
    expect(typeof body.generatedAt).toBe("string");
    expect(body.summary).toMatchObject({
      activeProjects: expect.any(Number),
      activeStatus: expect.any(Number),
      onTrack: expect.any(Number),
      notStarted: expect.any(Number),
      blocked: expect.any(Number),
      completedThisWeek: expect.any(Number),
    });

    expect(body.projects).toHaveLength(1);
    const project = body.projects[0];
    expect(project).toMatchObject({
      id: "p1",
      name: "Sample",
      status: "Active",
      priority: "High",
      phase: "In Progress",
      progress: 50,
      progressMethod: "checklist",
      checklistDone: 1,
      checklistTotal: 2,
      targetCompletion: "2026-08-01",
      lastUpdated: "2026-07-19T12:00:00.000Z",
      completedAt: null,
      description: "A summary",
      source: "delivery",
      programName: null,
    });
    expect(project.owners).toEqual([{ id: "o1", name: "Ada", initials: "A" }]);
    expect(project.owners[0]).not.toHaveProperty("avatarUrl");
    expect(JSON.stringify(body)).not.toContain("avatarUrl");
    expect(JSON.stringify(body)).not.toContain("example.com/avatar");
  });

  it("strips avatar URLs from nested child owners recursively", async () => {
    getProjects.mockResolvedValue([
      {
        ...sampleProject,
        children: [
          {
            id: "c1",
            name: "Child",
            phase: "In Progress",
            status: "Active",
            owners: [
              {
                id: "o2",
                name: "Bob",
                initials: "B",
                avatarUrl: "https://example.com/child-avatar.png",
              },
            ],
          },
        ],
      },
    ]);
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    const body = await res.json();
    expect(body.projects[0].children[0].owners).toEqual([
      { id: "o2", name: "Bob", initials: "B" },
    ]);
    expect(JSON.stringify(body)).not.toContain("avatarUrl");
    expect(JSON.stringify(body)).not.toContain("child-avatar");
  });

  it("uses stage_estimate when checklistTotal is 0", async () => {
    getProjects.mockResolvedValue([
      { ...sampleProject, checklistDone: 0, checklistTotal: 0, progress: 40 },
    ]);
    const res = await GET(requestWithAuth(`Bearer ${TOKEN}`));
    const body = await res.json();
    expect(body.projects[0].progressMethod).toBe("stage_estimate");
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
