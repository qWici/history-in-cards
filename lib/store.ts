import { create } from "zustand";
import type { GameCard, PlacedCard } from "./types";
import { buildDailyDeck, buildDeck, correctIndex, isValidPlacement, kyivToday } from "./game";
import { saveDailyResult } from "./daily";

const BEST_KEY = "ua-trivia:best";
const SEEN_KEY = "ua-trivia:seen";
const SEEN_MAX = 150; // скільки останніх бачених карток пам'ятаємо між партіями
export const LIVES = 3;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markSeen(qids: string[]) {
  const seen = readSeen().filter((q) => !qids.includes(q));
  seen.push(...qids);
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)));
}

export type GameStatus = "idle" | "loading" | "playing" | "over";
export type GameMode = "classic" | "daily";

export interface StartConfig {
  mode?: GameMode;
  /** Обмежити пул категоріями (slug'и) — режим «гра за категорією». */
  slugs?: string[] | null;
}

interface Move {
  qid: string;
  correct: boolean;
}

interface GameState {
  status: GameStatus;
  mode: GameMode;
  deck: GameCard[];
  current: GameCard | null;
  timeline: PlacedCard[];
  lives: number;
  score: number;
  best: number;
  moves: Move[];
  /** Скільки карток треба розкласти за партію (для прогресу в daily). */
  totalToPlace: number;
  lastMove: Move | null;
  start: (config?: StartConfig) => Promise<void>;
  /** Гравець кладе поточну картку в слот index (перед timeline[index]). */
  place: (index: number) => void;
}

let poolCache: GameCard[] | null = null;

async function loadPool(): Promise<GameCard[]> {
  if (poolCache) return poolCache;
  const res = await fetch("/data/all.json");
  if (!res.ok) throw new Error(`data load failed: ${res.status}`);
  poolCache = (await res.json()) as GameCard[];
  return poolCache;
}

export const useGame = create<GameState>((set, get) => ({
  status: "idle",
  mode: "classic",
  deck: [],
  current: null,
  timeline: [],
  lives: LIVES,
  score: 0,
  best: 0,
  moves: [],
  totalToPlace: 0,
  lastMove: null,

  start: async (config = {}) => {
    const mode = config.mode ?? "classic";
    set({ status: "loading", mode });
    let pool = await loadPool();
    if (config.slugs?.length) {
      const wanted = new Set(config.slugs);
      pool = pool.filter((c) => wanted.has(c.category));
    }
    const deck =
      mode === "daily"
        ? buildDailyDeck(pool, kyivToday()) // однакова для всіх — без seen
        : buildDeck(pool, 200, new Set(readSeen()));
    const [first, second, ...rest] = deck;
    markSeen([first.qid, second.qid]);
    set({
      status: "playing",
      timeline: [{ ...first, correct: true }],
      current: second,
      deck: rest,
      // у щоденному життя не закінчуються — граються всі 12 карток
      lives: mode === "daily" ? Number.POSITIVE_INFINITY : LIVES,
      score: 0,
      moves: [],
      totalToPlace: deck.length - 1,
      lastMove: null,
      best: Number(localStorage.getItem(BEST_KEY) ?? 0),
    });
  },

  place: (index) => {
    const { timeline, current, deck, lives, score, best, status, mode, moves } =
      get();
    if (status !== "playing" || !current) return;

    const correct = isValidPlacement(timeline, index, current.year);
    const insertAt = correct ? index : correctIndex(timeline, current.year);
    const nextTimeline = [...timeline];
    nextTimeline.splice(insertAt, 0, { ...current, correct });

    const nextLives = correct ? lives : lives - 1;
    const nextScore = correct ? score + 1 : score;
    const nextMoves = [...moves, { qid: current.qid, correct }];
    const over = nextLives <= 0 || deck.length === 0;
    if (!over) markSeen([deck[0].qid]); // наступна витягнута картка — теж бачена

    // Пишемо рекорд одразу, щойно він побитий (а не в кінці гри) —
    // так він переживає і закриту вкладку посеред партії
    let nextBest = best;
    if (mode === "classic") {
      nextBest = Math.max(best, nextScore);
      if (nextBest > best) localStorage.setItem(BEST_KEY, String(nextBest));
    }
    if (over && mode === "daily") {
      saveDailyResult(
        nextScore,
        nextMoves.length,
        nextMoves.map((m) => (m.correct ? "🟩" : "🟥")).join(""),
      );
    }

    set({
      timeline: nextTimeline,
      current: over ? null : deck[0],
      deck: over ? deck : deck.slice(1),
      lives: nextLives,
      score: nextScore,
      best: nextBest,
      moves: nextMoves,
      status: over ? "over" : "playing",
      lastMove: { qid: current.qid, correct },
    });
  },
}));
