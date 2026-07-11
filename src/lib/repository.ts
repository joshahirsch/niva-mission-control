import "server-only";
import type { ProjectRepository } from "@/repository/project-repository";
import { TrelloAdapter } from "@/adapters/trello/trello-adapter";
import { MockAdapter } from "@/adapters/mock-adapter";

/**
 * The single place the data source is chosen. Swapping Trello for BigQuery
 * later means adding an adapter and one line here — nothing above this changes.
 */
let cached: ProjectRepository | null = null;

export function getRepository(): ProjectRepository {
  if (cached) return cached;
  const source = (process.env.DATA_SOURCE ?? "trello").toLowerCase();
  cached = source === "mock" ? new MockAdapter() : new TrelloAdapter();
  return cached;
}
