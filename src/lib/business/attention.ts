import type { AttentionItem, AttentionReason, Project } from "@/domain/project";
import { isPastDue } from "./portfolio";

const STALE_PENDING_DAYS = 14;

const REASON_WEIGHT: Record<AttentionReason, number> = {
  Blocked: 4,
  Urgent: 3,
  "Past Due": 2,
  "Stale Pending": 1,
};

function reasonsFor(p: Project, now: number): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (p.status === "Blocked") reasons.push("Blocked");
  if (p.priority === "Urgent" && p.status !== "Completed") reasons.push("Urgent");
  if (isPastDue(p, now)) reasons.push("Past Due");
  const ageDays = (now - new Date(p.lastUpdated).getTime()) / (24 * 60 * 60 * 1000);
  if (p.status === "Pending" && ageDays > STALE_PENDING_DAYS) reasons.push("Stale Pending");
  return reasons;
}

/** Projects that need executive attention, most-severe first. */
export function computeExecutiveAttention(projects: Project[], now = Date.now()): AttentionItem[] {
  return projects
    .map((project) => ({ project, reasons: reasonsFor(project, now) }))
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => {
      const score = (i: AttentionItem) => i.reasons.reduce((s, r) => s + REASON_WEIGHT[r], 0);
      return score(b) - score(a);
    });
}
