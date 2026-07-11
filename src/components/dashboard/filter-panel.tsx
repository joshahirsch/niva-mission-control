"use client";

import { X } from "lucide-react";
import { PHASE, PRIORITY, STATUS } from "@/domain/project";
import { cn } from "@/lib/utils";

export interface Filters {
  status: string;
  priority: string;
  phase: string;
  owner: string;
  completion: string;
}

export const EMPTY_FILTERS: Filters = { status: "", priority: "", phase: "", owner: "", completion: "" };

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 rounded-md border border-input bg-background/60 px-2.5 text-sm text-foreground",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterPanel({
  filters,
  owners,
  onChange,
  onClear,
}: {
  filters: Filters;
  owners: { value: string; label: string }[];
  onChange: (next: Filters) => void;
  onClear: () => void;
}) {
  const set = (key: keyof Filters) => (v: string) => onChange({ ...filters, [key]: v });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-4">
      <Select label="Status" value={filters.status} onChange={set("status")} options={STATUS.map((s) => ({ value: s, label: s }))} />
      <Select label="Priority" value={filters.priority} onChange={set("priority")} options={PRIORITY.map((p) => ({ value: p, label: p }))} />
      <Select label="Phase" value={filters.phase} onChange={set("phase")} options={PHASE.map((p) => ({ value: p, label: p }))} />
      <Select label="Owner" value={filters.owner} onChange={set("owner")} options={owners} />
      <Select
        label="Completion"
        value={filters.completion}
        onChange={set("completion")}
        options={[
          { value: "lt25", label: "Under 25%" },
          { value: "25to75", label: "25–75%" },
          { value: "gt75", label: "Over 75%" },
          { value: "complete", label: "100%" },
        ]}
      />
      {hasFilters ? (
        <button
          onClick={onClear}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
