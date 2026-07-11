import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getRepository().getProjectById(params.id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load project.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
