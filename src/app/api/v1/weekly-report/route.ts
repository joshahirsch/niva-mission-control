import { NextResponse } from "next/server";
import {
  authenticateBearer,
  misconfiguredResponse,
  unauthorizedResponse,
} from "@/lib/api-auth";
import {
  buildWeeklyReportMarkdown,
  weeklyReportFilename,
} from "@/lib/business/weekly-report";
import { parseAsOfQueryParam } from "@/lib/business/reporting-time";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function invalidAsOfResponse(): NextResponse {
  return NextResponse.json(
    { error: "Invalid asOf" },
    { status: 400, headers: NO_STORE },
  );
}

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (!auth.ok) {
    if (auth.reason === "misconfigured") {
      console.error(
        "[api/v1/weekly-report] MISSION_CONTROL_API_TOKEN is not configured",
      );
      return misconfiguredResponse();
    }
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const asOfParam = url.searchParams.get("asOf");
  let asOf = new Date();
  if (asOfParam !== null) {
    const parsed = parseAsOfQueryParam(asOfParam);
    if (!parsed.ok) {
      return invalidAsOfResponse();
    }
    asOf = parsed.asOf;
  }

  try {
    const projects = await getRepository().getProjects();
    const markdown = buildWeeklyReportMarkdown(projects, asOf);
    const filename = weeklyReportFilename(asOf);
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    console.error("[api/v1/weekly-report] upstream failure", {
      name,
      path: "/api/v1/weekly-report",
    });
    return NextResponse.json(
      { error: "Bad gateway" },
      { status: 502, headers: NO_STORE },
    );
  }
}
