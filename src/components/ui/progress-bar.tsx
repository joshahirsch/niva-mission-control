import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    pct >= 100 ? "bg-status-green" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-status-gold" : "bg-status-gray";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
