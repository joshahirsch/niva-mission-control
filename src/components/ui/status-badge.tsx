import { CheckCircle2, Clock, Ban } from "lucide-react";
import { Badge } from "./badge";
import type { ProjectStatus } from "@/domain/project";

const MAP = {
  Completed: { tone: "green", Icon: CheckCircle2 },
  Pending: { tone: "gold", Icon: Clock },
  Blocked: { tone: "orange", Icon: Ban },
} as const;

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { tone, Icon } = MAP[status];
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
