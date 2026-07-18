import type {
  Owner,
  ProjectSource,
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
  blocked: "Blocked",
  "working on": "In Progress",
  bugs: "In Progress",
  "sprint backlog": "Ready",
  done: "Completed",
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * List names are decorated differently on each board — the delivery board uses
 * "Done 🎉 - 2026" (word first) while the program board uses "📆 Sprint - Done
 * [Version: 1.2.0]" (emoji first). Strip any leading non-alphanumeric characters
 * so both normalize to something matchable. Without this every card on an
 * emoji-prefixed board silently falls through to "Planned".
 */
function normalizeListName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

/** Cards parked in a template/example list are scaffolding, not initiatives. */
export function isTemplateList(listName: string | undefined): boolean {
  if (!listName) return false;
  const n = normalizeListName(listName);
  return n.startsWith("template") || n.includes("templates");
}

/**
 * Trello's scrum template seeds a board with furniture that is not work:
 *   - bracketed example cards: "[Example Feature]", "[Task] Template"
 *   - a descriptive header card inside each list, named after the list itself
 *     ("🗓 Sprint Backlog" sitting in "🗓 Sprint Backlog - [Timeline]")
 * Both would otherwise appear as initiatives on the executive board.
 */
export function isScaffoldingCard(cardName: string, listName: string | undefined): boolean {
  const name = cardName.trim();
  if (!name) return true;

  // "[Example Feature]", "[Task] Template", "[Example task]" ...
  if (name.startsWith("[")) return true;

  // A card whose name mirrors the list it sits in is that list's header card.
  const card = normalizeListName(name);
  const list = normalizeListName(listName ?? "");
  if (card && list && (list === card || list.startsWith(`${card} `) || list.startsWith(`${card}-`))) {
    return true;
  }
  return false;
}

export function mapPhase(listName: string | undefined): ProjectPhase {
  if (!listName) return "Planned";
  const n = normalizeListName(listName);

  // Exact match first (clean list names).
  if (PHASE_BY_LIST[n]) return PHASE_BY_LIST[n];

  // Fuzzy fallback for decorated list names across both boards.
  // \bdone\b (not startsWith) so "Sprint - Done [Version: 1.2.0]" matches while
  // "To Do" and "Doing" correctly do not.
  if (/\bdone\b/.test(n) || n.includes("complete") || n.includes("shipped")) return "Completed";
  if (n.startsWith("backlog")) return "Planned";
  if (n.startsWith("design")) return "In Design";
  if (n.startsWith("sprint backlog") || n.startsWith("to do") || n.startsWith("todo") || n.startsWith("ready"))
    return "Ready";
  if (
    n.startsWith("doing") ||
    n.startsWith("working on") ||
    n.startsWith("bugs") ||
    n.includes("in progress") ||
    n.includes("in-progress")
  )
    return "In Progress";
  if (n.startsWith("blocked")) return "Blocked";
  if (n.startsWith("review")) return "Leadership Review";
  if (n.startsWith("testing") || n.startsWith("validation") || n.startsWith("qa")) return "Validation";
  return "Planned";
}

export function mapStatus(labels: TrelloLabel[], phase: ProjectPhase): ProjectStatus {
  const names = labels.map((l) => normalize(l.name));
  // Blocked always surfaces — even over list position.
  if (names.some((n) => n.includes("blocked"))) return "Blocked";
  // A card parked in the "Blocked" list is blocked regardless of its labels.
  if (phase === "Blocked") return "Blocked";
  // List position is authoritative for completion: a card in a "Done" list is
  // Completed even if it still carries a stale label. This keeps finished
  // work out of the active-project counts.
  if (phase === "Completed") return "Completed";
  // Explicit DONE label completes a card that has not reached a Done list yet.
  if (names.some((n) => n.includes("done") || n.includes("complete"))) return "Completed";
  // No board convention reliably marks "pending" as a real per-card label, so
  // don't invent one — derive it from where the card actually sits in the
  // pipeline instead. Still in the backlog list means work hasn't begun;
  // anywhere past that means it's active.
  return phase === "Planned" ? "Not Started" : "Active";
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

/**
 * Stage-based progress estimate, used only when a card has no checklist.
 * These are deliberate approximations of pipeline position — the UI marks any
 * value derived this way as an estimate so it is never mistaken for a measurement.
 */
const PHASE_PROGRESS: Record<ProjectPhase, number> = {
  Planned: 0,
  "In Design": 15,
  Ready: 30,
  "In Progress": 50,
  Blocked: 50,
  "Leadership Review": 75,
  Validation: 90,
  Completed: 100,
};

export function mapProgress(
  card: TrelloCard,
  status: ProjectStatus,
  phase: ProjectPhase,
): number {
  const { checkItems, checkItemsChecked } = card.badges ?? { checkItems: 0, checkItemsChecked: 0 };
  // Measured: the team tracked real tasks on this card.
  if (checkItems > 0) return Math.round((checkItemsChecked / checkItems) * 100);
  if (status === "Completed") return 100;
  // Inferred: no checklist, so fall back to where the card sits in the pipeline.
  // Returning 0 here would read as "nothing done", which is a different claim
  // than "not tracked" — and a misleading one on an executive dashboard.
  return PHASE_PROGRESS[phase] ?? 0;
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

/** Splits "Programme | Child" into its parent programme name, if present. */
export function parseProgramName(cardName: string): string | null {
  const idx = cardName.indexOf(" | ");
  if (idx <= 0) return null;
  const parent = cardName.slice(0, idx).trim();
  return parent.length ? parent : null;
}

export function bundleToProjects(bundle: TrelloBoardBundle, source: ProjectSource): Project[] {
  const listById = new Map(bundle.lists.map((l) => [l.id, l.name]));
  const memberById = new Map(bundle.members.map((m) => [m.id, m]));
  const activity = activityByCard(bundle.actions);

  return bundle.cards
    .filter((c) => !c.closed)
    // Template/example scaffolding is board furniture, not initiatives.
    .filter((c) => !isTemplateList(listById.get(c.idList)))
    .filter((c) => !isScaffoldingCard(c.name, listById.get(c.idList)))
    .map((card): Project => {
      const phase = mapPhase(listById.get(card.idList));
      const status = mapStatus(card.labels ?? [], phase);
      const priority = mapPriority(card.labels ?? []);
      const progress = mapProgress(card, status, phase);
      const badges = card.badges ?? { checkItems: 0, checkItemsChecked: 0 };
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
        checklistDone: badges.checkItemsChecked,
        checklistTotal: badges.checkItems,
        owners,
        targetCompletion: card.due,
        lastUpdated: card.dateLastActivity,
        description: card.desc && card.desc.trim() ? card.desc : null,
        source,
        programName: source === "delivery" ? parseProgramName(card.name) : null,
        children: [],
        recentActivity: activity.get(card.id) ?? [],
      };
    });
}
