import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf(days, "day");
  const months = Math.round(days / 30);
  return rtf(months, "month");
}

function rtf(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-value, unit);
}

/** Human label for a target completion date relative to now, e.g. "Due in 5 days" / "3 days overdue". */
export function dueLabel(iso: string | null): string {
  if (!iso) return "No target date";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "No target date";
  const days = Math.round((target - Date.now()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
}

/** Triggers a browser download of the given text as a file. Client-side (presentation-layer) only. */
export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Strip common Markdown tokens for compact previews (card summaries). */
export function stripMarkdown(md: string): string {
  return md
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Describes where a progress figure came from: measured tasks vs stage estimate. */
export function progressLabel(checklistDone: number, checklistTotal: number): string {
  return checklistTotal > 0 ? `${checklistDone}/${checklistTotal} tasks` : "stage-based";
}
