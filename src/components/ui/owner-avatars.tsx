import type { Owner } from "@/domain/project";
import { cn } from "@/lib/utils";

export function OwnerAvatars({ owners, className }: { owners: Owner[]; className?: string }) {
  if (owners.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Unassigned</span>;
  }
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {owners.slice(0, 3).map((o) => (
          <span
            key={o.id}
            title={o.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-elevated text-[10px] font-semibold text-foreground"
          >
            {o.initials}
          </span>
        ))}
      </div>
      <span className="ml-2 truncate text-xs text-muted-foreground">
        {owners.length === 1 ? owners[0].name : `${owners[0].name} +${owners.length - 1}`}
      </span>
    </div>
  );
}
