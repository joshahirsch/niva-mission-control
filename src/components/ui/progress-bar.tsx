import { cn } from "@/lib/utils";

/**
 * `inferred` marks a bar whose value was estimated from pipeline phase rather
 * than measured from a checklist. Estimated bars are dimmed and hatched so an
 * executive can tell at a glance which numbers are real measurements.
 */
export function ProgressBar({
  value,
  className,
  inferred = false,
}: {
  value: number;
  className?: string;
  inferred?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    pct >= 100 ? "bg-status-green" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-status-gold" : "bg-status-gray";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone, inferred && "opacity-50")}
          style={{
            width: `${pct}%`,
            ...(inferred
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 3px, transparent 3px 6px)",
                }
              : {}),
          }}
        />
      </div>
    </div>
  );
}
