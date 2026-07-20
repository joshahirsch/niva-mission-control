import { describe, expect, it } from "vitest";
import {
  easternCalendarDate,
  parseAsOfQueryParam,
  startOfReportingWeek,
  zonedLocalToUtc,
} from "@/lib/business/reporting-time";

describe("parseAsOfQueryParam", () => {
  it("accepts Z and numeric offsets", () => {
    expect(parseAsOfQueryParam("2026-07-19T22:00:00Z")).toEqual({
      ok: true,
      asOf: new Date("2026-07-19T22:00:00Z"),
    });
    expect(parseAsOfQueryParam("2026-07-19T22:00:00-04:00")).toEqual({
      ok: true,
      asOf: new Date("2026-07-19T22:00:00-04:00"),
    });
    expect(parseAsOfQueryParam("2026-07-19T22:00:00+05:30")).toEqual({
      ok: true,
      asOf: new Date("2026-07-19T22:00:00+05:30"),
    });
    expect(parseAsOfQueryParam("2026-07-19T22:00:00.123Z").ok).toBe(true);
  });

  it("accepts valid month lengths and leap-year February 29", () => {
    expect(parseAsOfQueryParam("2024-02-29T12:00:00Z")).toEqual({
      ok: true,
      asOf: new Date("2024-02-29T12:00:00Z"),
    });
    expect(parseAsOfQueryParam("2026-04-30T12:00:00Z").ok).toBe(true);
    expect(parseAsOfQueryParam("2026-07-31T12:00:00Z").ok).toBe(true);
  });

  it("rejects date-only and timezone-naive values", () => {
    expect(parseAsOfQueryParam("2026-07-19")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAsOfQueryParam("2026-07-19T22:00:00")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseAsOfQueryParam("not-a-date")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAsOfQueryParam("")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects trailing junk", () => {
    expect(parseAsOfQueryParam("2026-07-19T22:00:00Zabc")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects impossible calendar dates without normalizing them", () => {
    const impossible = [
      "2026-02-30T12:00:00Z",
      "2026-04-31T12:00:00Z",
      "2025-02-29T12:00:00Z",
      "2026-09-31T00:00:00Z",
      "2026-13-01T12:00:00Z",
      "2026-00-10T12:00:00Z",
    ];
    for (const value of impossible) {
      expect(parseAsOfQueryParam(value)).toEqual({ ok: false, reason: "invalid" });
    }
    // Date silently rolls these forward; the parser must not accept that instant.
    expect(new Date("2026-02-30T12:00:00Z").toISOString()).toBe("2026-03-02T12:00:00.000Z");
    expect(new Date("2025-02-29T12:00:00Z").toISOString()).toBe("2025-03-01T12:00:00.000Z");
  });

  it("rejects invalid hours, minutes, and seconds", () => {
    expect(parseAsOfQueryParam("2026-07-19T24:00:00Z")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseAsOfQueryParam("2026-07-19T22:60:00Z")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseAsOfQueryParam("2026-07-19T22:00:60Z")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects invalid positive and negative offsets", () => {
    expect(parseAsOfQueryParam("2026-07-19T22:00:00+25:00")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseAsOfQueryParam("2026-07-19T22:00:00-12:60")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("eastern calendar helpers", () => {
  it("formats Monday midnight Eastern as the Eastern calendar Monday", () => {
    const monday = zonedLocalToUtc(2026, 7, 13, 0, 0, 0);
    expect(easternCalendarDate(monday)).toBe("2026-07-13");
    expect(startOfReportingWeek(monday).toISOString()).toBe(monday.toISOString());
  });
});
