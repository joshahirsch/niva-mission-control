import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * When MISSION_CONTROL_API_ONLY=true, only the bearer-token v1 routes are
 * reachable (`/api/v1/delivery`, `/api/v1/weekly-report`). The API service has
 * no UI and does not serve browser assets. Everything else gets a plain 404 —
 * no redirect to Google Sign-In / IAP.
 *
 * When unset or false, this middleware is a no-op so the existing IAP-protected
 * Mission Control app behaves unchanged.
 */
/** Env key read dynamically so Cloud Run can set this at runtime, not only at build time. */
const API_ONLY_ENV = "MISSION_CONTROL_API_ONLY";

const API_ONLY_ALLOWLIST = new Set([
  "/api/v1/delivery",
  "/api/v1/weekly-report",
]);

export function isApiOnlyMode(
  value: string | undefined = process.env[API_ONLY_ENV],
): boolean {
  return value === "true";
}

export function isAllowedInApiOnlyMode(pathname: string): boolean {
  return API_ONLY_ALLOWLIST.has(pathname);
}

export function middleware(request: NextRequest) {
  if (!isApiOnlyMode()) {
    return NextResponse.next();
  }

  if (isAllowedInApiOnlyMode(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: [
    /*
     * Run on all paths (including /_next/* and /favicon.ico) so API-only mode
     * can hard-block browser assets, the dashboard, and internal routes.
     */
    "/((?!_next/webpack-hmr).*)",
  ],
};
