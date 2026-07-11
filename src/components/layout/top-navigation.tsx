"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Radar, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchBar } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";

export function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Keep the box in sync when navigating.
  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  // Debounced push of the global search term into the URL (dashboard reads it).
  useEffect(() => {
    const id = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (query === current) return;
      const next = new URLSearchParams(Array.from(params.entries()));
      if (query) next.set("q", query);
      else next.delete("q");
      const target = pathname === "/" ? `/?${next.toString()}` : `/?${next.toString()}`;
      router.replace(target.endsWith("?") ? "/" : target);
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Radar className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
            NIVA Mission Control
          </span>
        </Link>

        <div className="mx-auto w-full max-w-md">
          <SearchBar value={query} onChange={setQuery} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden text-xs text-muted-foreground md:inline">{today}</span>
          <button
            aria-label="Settings"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
          </button>
          <span
            title="Dr. Amara Foss"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-foreground"
          >
            AF
          </span>
        </div>
      </div>
    </header>
  );
}
