import type {
  Owner,
  Project,
  ProjectPhase,
  ProjectPriority,
  ProjectStatus,
} from "@/domain/project";
import type { TrelloBoardBundle } from "./client";
import type { TrelloAction, TrelloCard, TrelloLabel, TrelloMember } from "./types";

/* ---------------- Label & list -> domain mapping ---------------- */

const PRIORITY_LABELS: Record<string, ProjectPriority> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const PHASE_BY_LIST: Record<string, ProjectPhase> = {
  backlog: "Planned",
  design: "In Design",
  "to do": "Ready",
  todo: "Ready",
  doing: "In Progress",
  review: "Leadership Review",
  testing: "Validation",
  done: "Completed",
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function mapPhase(listName: string | undefined): ProjectPhase {
  if (!listName) return "Planned";
  const n = normalize(listName);
  // Exact match first (clean list names).
  if (PHASE_BY_LIST[n]) return PHASE_BY_LIST[n];
  // Fuzzy fallback for decorated list names (e.g. "Done \u{1F389} - 2026", "Done \u{1F389} - 2025").
  if (n.startsWith("done") || n.includes("complete")) return "Completed";
  if (n.startsWith("backlog")) return "Planned";
  if (n.startsWith("design")) return "In Design";
  if (n.startsWith("to do") || n.startsWith("todo") || n.startsWith("ready")) return "Ready";
  if (n.startsWith("doing") || n.includes("in progress") || n.includes("in-progress")) return "In Progress";
  if (n.startsWith("review")) return "Leadership Review";
  if (n.startsWith("testing") || n.startsWith("validation") || n.startsWith("qa")) return "Validation";
  return "Planned";
}

export function mapStatus(labels: TrelloLabel[], phase: ProjectPhase): ProjectStatus {
  const names = labels.map((l) => normalize(l.name));
  // Blocked always surfaces — even over list position.
  if (names.some((n) => n.includes("blocked"))) return "Blocked";
  // List position is authoritative for completion: a card in a "Done" list is
  // Completed even if it still carries a stale PENDING label. This keeps finished
  // work out of the Executive Attention panel and the active-project counts.
  if (phase === "Completed") return "Completed";
  // Explicit DONE label completes a card that has not reached a Done list yet.
  if (names.some((n) => n.includes("done") || n.includes("complete"))) return "Completed";
  // Everything else on the board is active work still awaiting completion.
  return "Pending";
}

export function mapPriority(labels: TrelloLabel[]): ProjectPriority {
  const names = labels.map((l) => normalize(l.name));
  // Exact label match first.
  for (const n of names) {
    const hit = PRIORITY_LABELS[n];
    if (hit) return hit;
  }
  // Fuzzy fallback for decorated priority labels (e.g. "\u{1F6A8} Urgent", "\u{1F7E1} High Priority").
  if (names.some((n) => n.includes("urgent"))) return "Urgent";
  if (names.some((n) => n.includes("high"))) return "High";
  if (names.some((n) => n.includes("normal"))) return "Normal";
  if (names.some((n) => n.includes("low"))) return "Low";
  return "Normal";
}

export function mapProgress(card: TrelloCard, status: ProjectStatus): number {
  const { checkItems, checkItemsChecked } = card.badges ?? { checkItems: 0, checkItemsChecked: 0 };
  if (checkItems > 0) return Math.round((checkItemsChecked / checkItems) * 100);
  return status === "Completed" ? 100 : 0;
}

function mapOwner(member: TrelloMember): Owner {
  const name = member.fullName?.trim() || member.username;
  const initials =
    member.initials?.trim() ||
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return {
    id: member.id,
    name,
    initials,
    avatarUrl: member.avatarUrl ? `${member.avatarUrl}/50.png` : null,
  };
}

/* ---------------- Recent activity ---------------- */

function describeAction(a: TrelloAction): string | null {
  switch (a.type) {
    case "createCard":
      return "Initiative created";
    case "commentCard":
      return a.data.text ? `Comment: ${a.data.text}` : "Comment added";
    case "updateCard":
      return a.data.listAfter ? `Moved to ${a.data.listAfter.name}` : "Initiative updated";
    case "updateCheckItemStateOnCard":
      return "Progress checklist updated";
    default:
      return null;
  }
}

function activityByCard(actions: TrelloAction[]): Map<string, Project["recentActivity"]> {
  const map = new Map<string, Project["recentActivity"]>();
  for (const a of actions) {
    const cardId = a.data.card?.id;
    if (!cardId) continue;
    const text = describeAction(a);
    if (!text) continue;
    const list = map.get(cardId) ?? [];
    if (list.length >= 6) continue;
    list.push({ id: a.id, text, at: a.date });
    map.set(cardId, list);
  }
  return map;
}

/* ---------------- Card -> Project ---------------- */

export function bundleToProjects(bundle: TrelloBoardBundle): Project[] {
  const listById = new Map(bundle.lists.map((l) => [l.id, l.name]));
  const memberById = new Map(bundle.members.map((m) => [m.id, m]));
  const activity = activityByCard(bundle.actions);

  return bundle.cards
    .filter((c) => !c.closed)
    .map((card): Project => {
      const phase = mapPhase(listById.get(card.idList));
      const status = mapStatus(card.labels ?? [], phase);
      const priority = mapPriority(card.labels ?? []);
      const progress = mapProgress(card, status);
      const owners = card.idMembers
        .map((id) => memberById.get(id))
        .filter((m): m is TrelloMember => Boolean(m))
        .map(mapOwner);

      return {
        id: card.id,
        name: card.name,
        status,
        priority,
        phase,
        progress,
        owners,
        targetCompletion: card.due,
        lastUpdated: card.dateLastActivity,
        description: card.desc && card.desc.trim() ? card.desc : null,
        recentActivity: activity.get(card.id) ?? [],
      };
    });
}
