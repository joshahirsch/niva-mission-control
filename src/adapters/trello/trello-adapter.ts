import "server-only";
import type { Project } from "@/domain/project";
import { ProjectsSchema } from "@/domain/project";
import type { ProjectRepository } from "@/repository/project-repository";
import { fetchBoardBundle } from "./client";
import { bundleToProjects } from "./mappers";

/**
 * Live Trello implementation of ProjectRepository.
 * Reads the board once, maps to domain Projects, validates with Zod.
 */
export class TrelloAdapter implements ProjectRepository {
  async getProjects(): Promise<Project[]> {
    const bundle = await fetchBoardBundle();
    const projects = bundleToProjects(bundle);
    return ProjectsSchema.parse(projects);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) ?? null;
  }
}
