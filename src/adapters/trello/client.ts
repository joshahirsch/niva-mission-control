import "server-only";
import type { TrelloAction, TrelloCard, TrelloList, TrelloMember } from "./types";

interface TrelloCredentials {
  apiKey: string;
  token: string;
  boardId: string;
  revalidate: number;
}

export function readTrelloCredentials(): TrelloCredentials {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;
  if (!apiKey || !token || !boardId) {
    throw new Error(
      "Trello is not configured. Set TRELLO_API_KEY, TRELLO_TOKEN and TRELLO_BOARD_ID in .env.local, or set DATA_SOURCE=mock to preview with sample data.",
    );
  }
  const revalidate = Number(process.env.DATA_REVALIDATE_SECONDS ?? "60");
  return { apiKey, token, boardId, revalidate: Number.isFinite(revalidate) ? revalidate : 60 };
}

const BASE = "https://api.trello.com/1";

async function get<T>(path: string, params: Record<string, string>, creds: TrelloCredentials): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", creds.apiKey);
  url.searchParams.set("token", creds.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Server-side cache; keeps the exec view fast and rate-limit friendly.
    next: { revalidate: creds.revalidate },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello API ${res.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

export interface TrelloBoardBundle {
  lists: TrelloList[];
  members: TrelloMember[];
  cards: TrelloCard[];
  actions: TrelloAction[];
}

/** Single logical read of everything Mission Control needs from a board. */
export async function fetchBoardBundle(creds = readTrelloCredentials()): Promise<TrelloBoardBundle> {
  const [lists, members, cards, actions] = await Promise.all([
    get<TrelloList[]>(`/boards/${creds.boardId}/lists`, { fields: "id,name", filter: "open" }, creds),
    get<TrelloMember[]>(
      `/boards/${creds.boardId}/members`,
      { fields: "id,fullName,username,initials,avatarUrl" },
      creds,
    ),
    get<TrelloCard[]>(
      `/boards/${creds.boardId}/cards`,
      {
        filter: "open",
        fields: "id,name,desc,idList,idMembers,labels,due,dateLastActivity,badges,closed",
      },
      creds,
    ),
    get<TrelloAction[]>(
      `/boards/${creds.boardId}/actions`,
      { filter: "createCard,updateCard,commentCard,updateCheckItemStateOnCard", limit: "200" },
      creds,
    ).catch(() => [] as TrelloAction[]),
  ]);

  return { lists, members, cards, actions };
}
