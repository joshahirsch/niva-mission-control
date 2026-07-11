# NIVA Mission Control

An executive visibility platform for NIVA Health. **Read-only by design** — it is
not a project manager. Project management stays in Trello; Mission Control gives
leadership a real-time operational snapshot so they never need to open Trello.

> Goal: an executive understands organizational health in **under 60 seconds** —
> what's active, what's blocked, what needs attention, who owns it, and where every
> initiative sits in its lifecycle.

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript (strict) · Tailwind CSS ·
shadcn/ui-style primitives · Lucide icons · Framer Motion (subtle) · TanStack Query · Zod.

## Architecture (Clean Architecture)

```
Presentation (components/, app/)
      ↓ depends on
Business logic (lib/business/)        ← portfolio + executive-attention rules
      ↓ depends on
Repository interface (repository/)    ← ProjectRepository
      ↓ implemented by
Data adapter (adapters/)              ← TrelloAdapter | MockAdapter
      ↓ talks to
Trello REST API
```

The UI depends only on the **domain model** (`src/domain/project.ts`) and the
`/api/projects` routes. It has no knowledge of Trello. Replacing Trello with
BigQuery later means writing one new adapter and changing one line in
`src/lib/repository.ts` — **zero UI changes**.

The Trello token is only ever read server-side (adapters + API routes are
`server-only`); it is never shipped to the browser.

## Quick start

```bash
npm install
cp .env.example .env.local
# then either configure Trello (below) or set DATA_SOURCE=mock
npm run dev
```

Open http://localhost:3000.

### Preview immediately (no credentials)

Set `DATA_SOURCE=mock` in `.env.local` to render the full UI against bundled
sample initiatives.

### Connect live Trello

Set in `.env.local`:

```
DATA_SOURCE=trello
TRELLO_API_KEY=...      # https://trello.com/power-ups/admin
TRELLO_TOKEN=...        # token generated for that key
TRELLO_BOARD_ID=...     # id (or short link) from the board URL
```

## Trello mapping

| Trello | Mission Control |
| --- | --- |
| Card title | Project name |
| Description | Executive brief (parsed by heading) |
| Members | Project owner(s) |
| Checklist % | Progress |
| Due date | Target completion |
| Last activity | Last updated |
| List (Backlog/Design/To Do/Doing/Review/Testing/Done) | Phase (Planned → Completed) |
| Label DONE/PENDING/BLOCKED | Status |
| Label Urgent/High/Normal/Low | Priority |

**Description template** — headings parsed into their own sections:

```
Executive Summary
Objective:
Success Metric:
Current Focus:
Current Blockers:
Next Milestone:
```

## Executive logic

- **On track**: active, not blocked, not past due.
- **Requires attention** (always surfaced first): Blocked, Urgent, Past Due, or
  Pending with no activity for 14+ days — ranked by severity.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |

## Deploy

Deploy to Vercel and set the same env vars in the project settings. No write
scopes are needed — a read-only Trello token is sufficient.

## Intentionally NOT built

Kanban, editing, drag-and-drop, comments, project creation, admin screens.
Mission Control is a read-only executive command center.
