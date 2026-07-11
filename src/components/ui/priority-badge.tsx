import { Badge } from "./badge";
import type { ProjectPriority } from "@/domain/project";

const TONE = {
  Urgent: "orange",
  High: "gold",
  Normal: "blue",
  Low: "gray",
} as const;

export function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  return <Badge tone={TONE[priority]}>{priority}</Badge>;
}
