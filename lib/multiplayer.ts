import type { GameCard, PlacedCard } from "./types";

/** Активна картка, як її бачать клієнти: БЕЗ року і будь-яких підказок
 *  на нього (fact/subtitle містять роки текстом, wiki-лінк — відповідь). */
export interface HiddenCard {
  qid: string;
  title: string;
  image: string | null;
  category: string;
}

export interface RoomPlayer {
  id: string;
  nick: string;
  lives: number;
  correctMoves: number;
  connected: boolean;
  /** Порядковий номер вибуття (1 = перший, хто вилетів); null = у грі. */
  eliminatedAt: number | null;
}

export type RoomPhase = "lobby" | "playing" | "finished";

export interface Standing {
  place: number;
  nick: string;
  id: string;
}

export interface RoomSnapshot {
  type: "snapshot";
  phase: RoomPhase;
  players: RoomPlayer[];
  hostId: string | null;
  timeline: PlacedCard[];
  current: HiddenCard | null;
  turnPlayerId: string | null;
  /** Дедлайн поточного ходу, ms epoch (для таймера на клієнті). */
  turnEndsAt: number | null;
  relocating: string | null;
  lastMove: { qid: string; correct: boolean; title: string; year: number } | null;
  deckLeft: number;
  standings: Standing[] | null;
}

export type ClientMessage =
  | { type: "join"; token: string; nick: string }
  | { type: "rename"; nick: string }
  | { type: "start" }
  | { type: "place"; index: number; qid: string };

export type ServerMessage =
  | RoomSnapshot
  | { type: "error"; message: string };

export const ROOM_LIMITS = {
  minPlayers: 2,
  maxPlayers: 8,
  turnSeconds: 45,
  lives: 3,
  nickMin: 2,
  nickMax: 20,
} as const;

/** Повна картка -> версія без підказок на рік. */
export function hideCard(card: GameCard): HiddenCard {
  return {
    qid: card.qid,
    title: card.title,
    image: card.image,
    category: card.category,
  };
}
