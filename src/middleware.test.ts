import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  isAllowedInApiOnlyMode,
  isApiOnlyMode,
  middleware,
} from "@/middleware";

function req(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost"));
}

describe("API-only mode helpers", () => {
  afterEach(() => {
    delete process.env.MISSION_CONTROL_API_ONLY;
  });

  it("isApiOnlyMode is false when unset or not true", () => {
    delete process.env.MISSION_CONTROL_API_ONLY;
    expect(isApiOnlyMode()).toBe(false);
    expect(isApiOnlyMode("false")).toBe(false);
    expect(isApiOnlyMode("1")).toBe(false);
  });

  it("isApiOnlyMode is true only for the string true", () => {
    expect(isApiOnlyMode("true")).toBe(true);
  });

  it("allows /api/v1/delivery and /api/v1/weekly-report", () => {
    expect(isAllowedInApiOnlyMode("/api/v1/delivery")).toBe(true);
    expect(isAllowedInApiOnlyMode("/api/v1/weekly-report")).toBe(true);
    expect(isAllowedInApiOnlyMode("/")).toBe(false);
    expect(isAllowedInApiOnlyMode("/favicon.ico")).toBe(false);
    expect(isAllowedInApiOnlyMode("/_next/static/example.js")).toBe(false);
    expect(isAllowedInApiOnlyMode("/_next/image")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/projects")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/programs")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/projects/example")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/hidden")).toBe(false);
    expect(isAllowedInApiOnlyMode("/project/abc")).toBe(false);
  });

  it("rejects lookalike and nested paths (exact match only)", () => {
    expect(isAllowedInApiOnlyMode("/api/v1/weekly-report/extra")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/v1/delivery/")).toBe(false);
    expect(isAllowedInApiOnlyMode("/api/v1/weekly-reporting")).toBe(false);
  });
});

describe("middleware", () => {
  afterEach(() => {
    delete process.env.MISSION_CONTROL_API_ONLY;
  });

  it.each([
    "/",
    "/favicon.ico",
    "/_next/static/example.js",
    "/_next/image",
    "/api/projects",
    "/api/programs",
    "/api/projects/example",
    "/api/hidden",
  ])("API-only mode blocks %s with plain 404", (path) => {
    process.env.MISSION_CONTROL_API_ONLY = "true";
    const res = middleware(req(path));
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("API-only mode allows /api/v1/delivery", async () => {
    process.env.MISSION_CONTROL_API_ONLY = "true";
    const res = middleware(req("/api/v1/delivery"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("API-only mode allows /api/v1/weekly-report", async () => {
    process.env.MISSION_CONTROL_API_ONLY = "true";
    const res = middleware(req("/api/v1/weekly-report"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/api/v1/weekly-report/extra",
    "/api/v1/delivery/",
    "/api/v1/weekly-reporting",
  ])("API-only mode blocks lookalike path %s with plain 404", (path) => {
    process.env.MISSION_CONTROL_API_ONLY = "true";
    const res = middleware(req(path));
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("API-only mode allows exact allowlisted paths with query strings", async () => {
    process.env.MISSION_CONTROL_API_ONLY = "true";
    for (const path of [
      "/api/v1/weekly-report?asOf=2026-07-19T22:00:00Z",
      "/api/v1/delivery?schemaVersion=1.0",
    ]) {
      const res = middleware(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("normal mode preserves application routes (passthrough)", async () => {
    delete process.env.MISSION_CONTROL_API_ONLY;
    for (const path of [
      "/",
      "/favicon.ico",
      "/_next/static/example.js",
      "/api/projects",
      "/api/v1/delivery",
      "/api/v1/weekly-report",
      "/project/x",
    ]) {
      const res = middleware(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("MISSION_CONTROL_API_ONLY=false preserves application routes", async () => {
    process.env.MISSION_CONTROL_API_ONLY = "false";
    const res = middleware(req("/api/projects"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
