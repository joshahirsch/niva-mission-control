import { z } from "zod";

/**
 * Domain model for NIVA Mission Control.
 *
 * These are the ONLY shapes the presentation layer knows about. No Trello
 * terminology, ids, or field names leak past this boundary. Swapping the data
 * source (Trello -> BigQuery) means writing a new adapter that produces these
 * same shapes; the UI never changes.
 */

export const STATUS = ["Completed", "Pending", "Blocked"] as const;
export const PRIORITY = ["Urgent", "High", "Normal", "Low"] as const;
export const PHASE = [
  "Planned",
  "In Design",
  "Ready",
  "In Progress",
  "Leadership Review",
  "Validation",
  "Completed",
] as const;

export const ProjectStatusSchema = z.enum(STATUS);
export const ProjectPrioritySchema = z.enum(PRIORITY);
export const ProjectPhaseSchema = z.enum(PHASE);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;
export type ProjectPhase = z.infer<typeof ProjectPhaseSchema>;

export const OwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  avatarUrl: z.string().url().nullable(),
});
export type Owner = z.infer<typeof OwnerSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: ProjectStatusSchema,
  priority: ProjectPrioritySchema,
  phase: ProjectPhaseSchema,
  /** 0-100 completion. */
  progress: z.number().min(0).max(100),
  owners: z.array(OwnerSchema),
  /** ISO date strings (nullable when unset). */
  targetCompletion: z.string().nullable(),
  lastUpdated: z.string(),
  /** Raw Trello card description (Markdown), as the team writes it. */
  description: z.string().nullable(),
  /** Human-readable recent activity lines. */
  recentActivity: z.array(
    z.object({ id: z.string(), text: z.string(), at: z.string() }),
  ),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectsSchema = z.array(ProjectSchema);

/* ---- Derived executive views (produced by the business layer) ---- */

export const AttentionReasonSchema = z.enum([
  "Blocked",
  "Urgent",
  "Past Due",
  "Stale Pending",
]);
export type AttentionReason = z.infer<typeof AttentionReasonSchema>;

export interface AttentionItem {
  project: Project;
  reasons: AttentionReason[];
}

export interface PortfolioSummary {
  activeProjects: number;
  onTrack: number;
  pending: number;
  blocked: number;
  completedThisWeek: number;
}
