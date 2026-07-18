import { z } from "zod";

/**
 * Domain model for NIVA Mission Control.
 *
 * These are the ONLY shapes the presentation layer knows about. No Trello
 * terminology, ids, or field names leak past this boundary. Swapping the data
 * source (Trello -> BigQuery) means writing a new adapter that produces these
 * same shapes; the UI never changes.
 */

export const STATUS = ["Not Started", "Active", "Blocked", "Completed"] as const;
export const PRIORITY = ["Urgent", "High", "Normal", "Low"] as const;
export const PHASE = [
  "Planned",
  "In Design",
  "Ready",
  "In Progress",
  "Leadership Review",
  "Validation",
  "Blocked",
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
  /** 0-100 completion. Measured from the checklist when one exists, otherwise
   * inferred from pipeline phase (see checklistTotal to tell which). */
  progress: z.number().min(0).max(100),
  /** Raw checklist counts. checklistTotal === 0 means the card has no checklist,
   * so `progress` is a stage-based estimate rather than a measurement. */
  checklistDone: z.number().min(0),
  checklistTotal: z.number().min(0),
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

export interface PortfolioSummary {
  activeProjects: number;
  onTrack: number;
  notStarted: number;
  blocked: number;
  completedThisWeek: number;
}
