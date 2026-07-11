"use client";

import { useQuery } from "@tanstack/react-query";
import { ProjectSchema, ProjectsSchema, type Project } from "@/domain/project";

async function fetchJson(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => ProjectsSchema.parse((await fetchJson("/api/projects")).projects),
  });
}

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => ProjectSchema.parse((await fetchJson(`/api/projects/${id}`)).project),
    enabled: Boolean(id),
  });
}
