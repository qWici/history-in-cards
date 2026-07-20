import { create } from "zustand";
import type { GameCard, PlacedCard } from "./types";
import { buildDailyDeck, buildDeck, correctIndex, isValidPlacement, kyivToday } from "./game";
import { saveDailyResult } from "./daily";
import { reportGameResult } from "./statsClient";

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

interface LastMove extends Move {
  title: string;
  year: number;
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
  lastMove: LastMove | null;
  /** QID картки, що після промаху чекає на переїзд у правильне місце. */
  relocating: string | null;
  /** Гра обмежена категоріями (для статистики: classic vs category). */
  categoryGame: boolean;
  start: (config?: StartConfig) => Promise<void>;
  /** Гравець кладе поточну картку в слот index (перед timeline[index]). */
  place: (index: number) => void;
  /** Фаза 2 промаху: перенести картку на правильну позицію і продовжити гру. */
  finishRelocation: () => void;
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
  relocating: null,
  categoryGame: false,

  start: async (config = {}) => {
    const mode = config.mode ?? "classic";
    set({ status: "loading", mode, categoryGame: !!config.slugs?.length });
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
      relocating: null,
      best: Number(localStorage.getItem(BEST_KEY) ?? 0),
    });
  },

  place: (index) => {
    const { timeline, current, deck, lives, score, best, status, mode, moves } =
      get();
    if (status !== "playing" || !current || get().relocating) return;

    const correct = isValidPlacement(timeline, index, current.year);
    const lastMove = {
      qid: current.qid,
      correct,
      title: current.title,
      year: current.year,
    };

    if (!correct) {
      // Фаза 1 промаху: картка лишається там, куди її поклали, — червона,
      // з відкритим роком. Переїзд на правильне місце — у finishRelocation()
      const nextTimeline = [...timeline];
      nextTimeline.splice(index, 0, { ...current, correct: false });
      set({
        timeline: nextTimeline,
        current: null,
        lives: lives - 1,
        moves: [...moves, { qid: current.qid, correct: false }],
        lastMove,
        relocating: current.qid,
      });
      return;
    }

    const nextTimeline = [...timeline];
    nextTimeline.splice(index, 0, { ...current, correct: true });
    const nextScore = score + 1;
    const nextMoves = [...moves, { qid: current.qid, correct: true }];
    const over = deck.length === 0;
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
    if (over) {
      reportGameResult(
        mode === "daily" ? "daily" : get().categoryGame ? "category" : "classic",
        nextScore,
        nextMoves.filter((m) => m.correct).length,
        nextMoves.filter((m) => !m.correct).length,
      );
    }

    set({
      timeline: nextTimeline,
      current: over ? null : deck[0],
      deck: over ? deck : deck.slice(1),
      score: nextScore,
      best: nextBest,
      moves: nextMoves,
      status: over ? "over" : "playing",
      lastMove,
    });
  },

  finishRelocation: () => {
    const { timeline, relocating, deck, lives, mode, score, moves } = get();
    if (!relocating) return;
    const idx = timeline.findIndex((c) => c.qid === relocating && !c.correct);
    if (idx === -1) return;
    const card = timeline[idx];
    const rest = timeline.filter((_, i) => i !== idx);
    const to = correctIndex(rest, card.year);
    const nextTimeline = [...rest];
    nextTimeline.splice(to, 0, card);

    const over = lives <= 0 || deck.length === 0;
    if (!over) markSeen([deck[0].qid]);
    if (over && mode === "daily") {
      saveDailyResult(
        score,
        moves.length,
        moves.map((m) => (m.correct ? "🟩" : "🟥")).join(""),
      );
    }
    if (over) {
      reportGameResult(
        mode === "daily" ? "daily" : get().categoryGame ? "category" : "classic",
        score,
        moves.filter((m) => m.correct).length,
        moves.filter((m) => !m.correct).length,
      );
    }

    set({
      timeline: nextTimeline,
      relocating: null,
      current: over ? null : deck[0],
      deck: over ? deck : deck.slice(1),
      status: over ? "over" : "playing",
    });
  },
}));
