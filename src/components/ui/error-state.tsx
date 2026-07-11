import { AlertTriangle, RotateCw } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-status-orange/30 bg-status-orange/5 px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-status-orange" />
      <h3 className="text-sm font-medium text-foreground">Unable to load data</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
