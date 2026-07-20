/**
 * Authoritative reporting calendar for weekly status.
 *
 * Week boundaries and filename dates are computed in America/New_York —
 * never by slicing UTC calendar days or approximating a week as 7×24h.
 */

export const REPORTING_TIME_ZONE = "America/New_York";

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * ISO-8601 datetime with mandatory Z or numeric offset (rejects date-only /
 * local-naive). Captures civil components so impossible calendar dates can be
 * rejected before JavaScript Date normalization.
 */
const AS_OF_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

const INVALID_AS_OF = { ok: false, reason: "invalid" } as const;

export type AsOfInstant = Date | number;

export type ParseAsOfResult =
  | { ok: true; asOf: Date }
  | { ok: false; reason: "invalid" };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Valid day count for a civil year/month (month is 1–12). */
function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function toAsOfDate(asOf: AsOfInstant = Date.now()): Date {
  if (asOf instanceof Date) {
    if (Number.isNaN(asOf.getTime())) {
      throw new RangeError("Invalid asOf Date");
    }
    return asOf;
  }
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid asOf timestamp");
  }
  return date;
}

/**
 * Parses an authenticated optional `asOf` query value.
 * Requires an explicit timezone offset or `Z`. Does not accept date-only values
 * or impossible calendar dates (e.g. Feb 30, Apr 31, Feb 29 in non-leap years).
 */
export function parseAsOfQueryParam(value: string): ParseAsOfResult {
  const match = AS_OF_PATTERN.exec(value);
  if (!match) {
    return INVALID_AS_OF;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) {
    return INVALID_AS_OF;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return INVALID_AS_OF;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return INVALID_AS_OF;
  }

  // Explicit numeric offset (absent when the timestamp ends in Z).
  if (match[7] !== undefined) {
    const offsetHour = Number(match[8]);
    const offsetMinute = Number(match[9]);
    if (offsetHour > 23 || offsetMinute > 59) {
      return INVALID_AS_OF;
    }
  }

  const asOf = new Date(value);
  if (!Number.isFinite(asOf.getTime())) {
    return INVALID_AS_OF;
  }
  return { ok: true, asOf };
}

export interface ZonedParts {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getZonedParts(
  instant: Date,
  timeZone: string = REPORTING_TIME_ZONE,
): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    weekday: map.weekday,
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Converts a civil wall-clock time in `timeZone` to the corresponding UTC instant.
 * Iterates to resolve the zone offset so DST transitions are handled correctly.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = REPORTING_TIME_ZONE,
): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = desiredAsUtc;
  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const gotAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = gotAsUtc - desiredAsUtc;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** Calendar-day arithmetic in a pure Y-M-D space (DST-safe vehicle for week math). */
export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Monday 12:00:00 AM America/New_York for the reporting week that contains `asOf`.
 * Sunday belongs to the week that began the preceding Monday.
 */
export function startOfReportingWeek(asOf: AsOfInstant): Date {
  const instant = toAsOfDate(asOf);
  const parts = getZonedParts(instant);
  const weekdayNum = WEEKDAY_TO_INDEX[parts.weekday];
  if (weekdayNum === undefined) {
    throw new Error(`Unexpected weekday label: ${parts.weekday}`);
  }
  const daysSinceMonday = (weekdayNum + 6) % 7;
  const monday = addCalendarDays(parts.year, parts.month, parts.day, -daysSinceMonday);
  return zonedLocalToUtc(monday.year, monday.month, monday.day, 0, 0, 0);
}

/** America/New_York calendar date for `asOf` as YYYY-MM-DD. */
export function easternCalendarDate(asOf: AsOfInstant): string {
  const parts = getZonedParts(toAsOfDate(asOf));
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

export function weeklyReportFilename(asOf: AsOfInstant): string {
  return `niva-weekly-status-${easternCalendarDate(asOf)}.md`;
}

/** Long-form generated-at line in America/New_York (deterministic across hosts). */
export function formatReportGeneratedAt(asOf: AsOfInstant): string {
  return toAsOfDate(asOf).toLocaleDateString("en-US", {
    timeZone: REPORTING_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a project date for the weekly Markdown report.
 * Date-only (YYYY-MM-DD) values keep their calendar day; timestamps use Eastern.
 */
export function formatReportDate(iso: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: REPORTING_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
