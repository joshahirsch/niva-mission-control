"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Eye, EyeOff } from "lucide-react";
import { useProjects } from "@/lib/hooks/use-projects";
import { filterProjects } from "@/lib/business/filter";
import { PortfolioSummary, type PortfolioFilterKey } from "./portfolio-summary";
import { ExecutiveAttentionPanel } from "./executive-attention-panel";
import { ProjectGrid } from "./project-grid";
import { FilterPanel, EMPTY_FILTERS, type Filters } from "./filter-panel";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const HIDDEN_KEY = "niva:hiddenCardIds";

export function DashboardView() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const params = useSearchParams();
  const query = params.get("q") ?? "";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [portfolioKey, setPortfolioKey] = useState<PortfolioFilterKey | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHiddenIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persistHidden = (next: Set<string>) => {
    setHiddenIds(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };
  const hideCard = (id: string) => {
    const next = new Set(hiddenIds);
    next.add(id);
    persistHidden(next);
  };
  const restoreCard = (id: string) => {
    const next = new Set(hiddenIds);
    next.delete(id);
    persistHidden(next);
  };

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    (projects ?? []).forEach((p) => p.owners.forEach((o) => map.set(o.id, o.name)));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [projects]);

  const visible = useMemo(
    () => filterProjects(projects ?? [], { query, filters, portfolioKey, hideCompleted: !showCompleted }),
    [projects, query, filters, portfolioKey, showCompleted],
  );
  const shown = useMemo(() => visible.filter((p) => !hiddenIds.has(p.id)), [visible, hiddenIds]);
  const hiddenList = useMemo(
    () => (projects ?? []).filter((p) => hiddenIds.has(p.id)),
    [projects, hiddenIds],
  );

  if (isLoading) return <DashboardSkeleton />;
  if (isError) return <ErrorState message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;
  if (!projects || projects.length === 0)
    return <EmptyState title="No initiatives yet" message="Projects will appear here once they exist on the board." />;

  return (
    <div className="space-y-10 animate-fade-in">
      <PortfolioSummary
        projects={projects}
        activeKey={portfolioKey}
        onSelect={(key) => setPortfolioKey((prev) => (prev === key ? null : key))}
      />

      <ExecutiveAttentionPanel projects={projects} />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Active Portfolio</h2>
          <span className="text-xs text-muted-foreground">
            {shown.length} of {projects.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {hiddenList.length > 0 ? (
              <button
                onClick={() => setShowHiddenPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hidden ({hiddenList.length})
              </button>
            ) : null}
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
          </div>
        </div>

        {showHiddenPanel && hiddenList.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Hidden from view ({hiddenList.length})
              </span>
              <button
                onClick={() => persistHidden(new Set())}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Restore all
              </button>
            </div>
            <ul className="divide-y divide-border">
              {hiddenList.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-sm text-foreground/80">{p.name}</span>
                  <button
                    onClick={() => restoreCard(p.id)}
                    className="shrink-0 text-xs text-primary transition-colors hover:underline"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <FilterPanel filters={filters} owners={owners} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />
        <ProjectGrid projects={shown} onHide={hideCard} />
      </section>
    </div>
  );
}
