import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await getRepository().getProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load projects.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
