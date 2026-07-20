"use client";

import { FileDown, Printer } from "lucide-react";
import type { Project } from "@/domain/project";
import {
  buildWeeklyReportMarkdown,
  weeklyReportFilename,
} from "@/lib/business/weekly-report";
import { downloadTextFile } from "@/lib/utils";

export function ReportActions({ projects }: { projects: Project[] }) {
  const handleDownloadReport = () => {
    const asOf = new Date();
    const md = buildWeeklyReportMarkdown(projects, asOf);
    downloadTextFile(weeklyReportFilename(asOf), md);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={handleDownloadReport}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <FileDown className="h-3.5 w-3.5" />
        Weekly report
      </button>
      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Printer className="h-3.5 w-3.5" />
        Export snapshot
      </button>
    </div>
  );
}
