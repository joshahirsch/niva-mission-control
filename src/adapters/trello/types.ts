/** Raw Trello REST shapes we consume. Kept internal to the adapter. */

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloMember {
  id: string;
  fullName: string | null;
  username: string;
  initials: string | null;
  avatarUrl: string | null;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloCardBadges {
  checkItems: number;
  checkItemsChecked: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idMembers: string[];
  labels: TrelloLabel[];
  due: string | null;
  dateLastActivity: string;
  badges: TrelloCardBadges;
  closed: boolean;
}

export interface TrelloAction {
  id: string;
  type: string;
  date: string;
  memberCreator?: { fullName: string | null } | null;
  data: {
    card?: { id: string; name?: string };
    listAfter?: { name: string };
    text?: string;
  };
}
