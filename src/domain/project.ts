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

/** Which Trello board a card came from. */
export const SOURCE = ["program", "delivery"] as const;
export const ProjectSourceSchema = z.enum(SOURCE);
export type ProjectSource = z.infer<typeof ProjectSourceSchema>;

/** A delivery card rolled up beneath a programme card. */
export const ProjectChildSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: ProjectPhaseSchema,
  status: ProjectStatusSchema,
  owners: z.array(OwnerSchema),
});
export type ProjectChild = z.infer<typeof ProjectChildSchema>;

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
  /**
   * When the card actually moved into a "Done" list. Null for cards that were
   * created straight into Done (backfilled historical records), which is what
   * keeps them out of "completed this week".
   */
  completedAt: z.string().nullable(),
  /** Raw Trello card description (Markdown), as the team writes it. */
  description: z.string().nullable(),
  /** Which board this came from. */
  source: ProjectSourceSchema,
  /** For delivery cards named "Programme | Child", the parent programme name. */
  programName: z.string().nullable(),
  /** For programme cards, the delivery work rolled up beneath it. */
  children: z.array(ProjectChildSchema),
  /** Human-readable recent activity lines. */
  recentActivity: z.array(
    z.object({ id: z.string(), text: z.string(), at: z.string() }),
  ),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectsSchema = z.array(ProjectSchema);

/* ---- Derived executive views (produced by the business layer) ---- */

export interface PortfolioSummary {
  /** Non-completed projects (Active + Blocked + Not Started). */
  activeProjects: number;
  /** Projects whose status enum is exactly `Active` (not the active-project total). */
  activeStatus: number;
  /** Health metric: non-completed, not blocked, not past due — not a status partition bucket. */
  onTrack: number;
  notStarted: number;
  blocked: number;
  completedThisWeek: number;
}

/** Programme view: programme cards plus delivery work with no programme card. */
export interface ProgramView {
  programs: Project[];
  unmapped: Project[];
}
