import type { Project } from "@/domain/project";

/**
 * The business + presentation layers depend only on this interface.
 * Data adapters (Trello today, BigQuery tomorrow) implement it.
 */
export interface ProjectRepository {
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
}
