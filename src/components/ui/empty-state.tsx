import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {message ? <p className="max-w-sm text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
