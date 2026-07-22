"use client";

import { Button, buttonVariants, Chip } from "@heroui/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BoardCore, BoardProvider } from "@/components/board/BoardCore";
import { CardModal } from "@/components/CardModal";
import { GameCardView } from "@/components/GameCard";
import { FlagUA } from "@/components/FlagUA";
import { HowToPlayModal } from "@/components/HowToPlayModal";
import { DailyResultView } from "@/components/DailyResult";
import type { GameMode } from "@/lib/store";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { DifficultySelect } from "@/components/DifficultySelect";
import { DIFFICULTIES, difficultyMeta } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/game";
import { correctIndex, formatYear, imageUrl, isValidPlacement } from "@/lib/game";
import { shareOrCopy } from "@/lib/share";
import { bestKey, LIVES, useGame } from "@/lib/store";

/** Дебаг-панель для розробки: NEXT_PUBLIC_DEBUG=true. У проді відсутня. */
function DebugPanel() {
  if (process.env.NEXT_PUBLIC_DEBUG !== "true") return null;

  function autoPlace(n: number, correct: boolean) {
    for (let i = 0; i < n; i++) {
      const s = useGame.getState();
      if (s.status !== "playing" || !s.current || s.relocating) break;
      let idx = correctIndex(s.timeline, s.current.year);
      if (!correct) {
        for (let j = 0; j <= s.timeline.length; j++) {
          if (!isValidPlacement(s.timeline, j, s.current.year)) {
            idx = j;
            break;
          }
        }
      }
      s.place(idx);
      // промах: не чекаємо на анімацію переїзду
      if (useGame.getState().relocating) useGame.getState().finishRelocation();
    }
  }

  const btn =
    "rounded bg-warning-soft px-2 py-1 text-xs font-semibold text-warning-soft-foreground hover:opacity-80";
  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border-2 border-dashed border-warning bg-background/90 p-2 shadow-lg">
      <span className="text-[10px] font-bold uppercase text-warning-soft-foreground">
        debug
      </span>
      <button type="button" className={btn} onClick={() => autoPlace(1, true)}>
        +1
      </button>
      <button type="button" className={btn} onClick={() => autoPlace(10, true)}>
        +10
      </button>
      <button type="button" className={btn} onClick={() => autoPlace(1, false)}>
        Промах
      </button>
      <button type="button" className={btn} onClick={() => autoPlace(3, false)}>
        Кінець
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          for (const k of [
            ...DIFFICULTIES.map((o) => bestKey(o.id)),
            "ua-trivia:seen",
            "ua-trivia:daily",
            "ua-trivia:reported",
          ])
            localStorage.removeItem(k);
          location.reload();
        }}
      >
        🧹
      </button>
    </div>
  );
}

function Lives({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Життя: ${lives} з ${LIVES}`}>
      {Array.from({ length: LIVES }, (_, i) => {
        const dead = i >= lives;
        // перший «мертвий» прапорець — щойно втрачений: програє анімацію;
        // key від lives перемонтовує вузол, тож анімація стартує щопомилки
        const dying = i === lives;
        return (
          <FlagUA
            key={dying ? `dying-${lives}` : i}
            width={30}
            className={dying ? "flag-lost" : dead ? "opacity-25 grayscale" : ""}
          />
        );
      })}
    </div>
  );
}

function GameOver() {
  const { score, best, timeline, start, moves, difficulty, categoryGame } =
    useGame();
  const [selected, setSelected] = useState<(typeof timeline)[number] | null>(null);
  const [copied, setCopied] = useState(false);
  const isRecord = score > 0 && score >= best;

  async function share() {
    const level = difficultyMeta(difficulty);
    const text = [
      "Історія в картках 🇺🇦",
      isRecord
        ? `Рахунок: ${score} · 🏆 новий рекорд!`
        : `Рахунок: ${score} (рекорд: ${best})`,
      ...(difficulty !== "normal"
        ? [`Складність: ${level.icon} ${level.label}`]
        : []),
      moves.map((m) => (m.correct ? "🟩" : "🟥")).join(""),
      window.location.origin,
    ].join("\n");
    if ((await shareOrCopy(text)) === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <h2 className="text-3xl font-bold">Гру завершено</h2>
      {!categoryGame && (
        <span className="-mt-3 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-soft-foreground">
          {difficultyMeta(difficulty).icon} {difficultyMeta(difficulty).label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-accent-soft-foreground shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
            Рахунок
          </span>
          <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
            {score}
          </span>
        </span>
        <span
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 shadow-sm ${
            isRecord
              ? "bg-success-soft text-success-soft-foreground"
              : "bg-warning-soft text-warning-soft-foreground"
          }`}
        >
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
            🏆 {isRecord ? "Новий рекорд!" : "Рекорд"}
          </span>
          {!isRecord && (
            <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
              {best}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => start({ difficulty })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          Зіграти ще раз
        </Button>
        <Button variant="outline" onClick={share}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="m8.7 10.7 6.6-3.4m-6.6 6 6.6 3.4" />
          </svg>
          {copied ? "Скопійовано ✓" : "Поділитися"}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M9 22V12h6v10" />
          </svg>
          На головну
        </Link>
      </div>
      <p className="text-sm text-muted">
        Твій таймлайн — натисни на картку, щоб почитати більше:
      </p>
      <div className="timeline-scroll flex w-full gap-3 overflow-x-auto pb-4">
        {timeline.map((card) => (
          <button
            key={`${card.qid}-${card.year}`}
            type="button"
            onClick={() => setSelected(card)}
            title={`${card.title} — ${formatYear(card.year)}`}
            className="cursor-pointer transition-transform hover:-translate-y-1"
          >
            <GameCardView card={card} showYear correct={card.correct} />
          </button>
        ))}
      </div>
      {selected && (
        <CardModal card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export interface GameBoardProps {
  mode?: GameMode;
  /** Обмежити пул категоріями (режим «за категорією»). */
  slugs?: string[];
  /** Назва категорії/групи для бейджа в хедері. */
  categoryName?: string;
}

export function GameBoard({ mode = "classic", slugs, categoryName }: GameBoardProps) {
  const {
    status,
    lives,
    score,
    best,
    current,
    start,
    place,
    moves,
    totalToPlace,
    timeline,
    lastMove,
    difficulty,
  } = useGame();
  // онбординг: показуємо правила при найпершій грі
  const [howToOpen, setHowToOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("ua-trivia:onboarded")) setHowToOpen(true);
  }, []);
  function closeHowTo() {
    localStorage.setItem("ua-trivia:onboarded", "1");
    setHowToOpen(false);
  }

  // Кожен захід на сторінку гри — нова партія (стор глобальний і переживає
  // навігацію, інакше після «Вийти» тут висів би стан попередньої гри)
  // Складність обирається на окремому екрані перед стартом — лише для
  // класики: категорійні пули для смуг замалі, а щоденна колода мусить
  // бути однакова для всіх
  const slugsKey = slugs?.join(",") ?? "";
  const needsDifficulty = mode === "classic" && !slugsKey;
  const [chosenDifficulty, setChosenDifficulty] = useState<Difficulty | null>(
    null,
  );
  useEffect(() => {
    if (needsDifficulty && !chosenDifficulty) return; // чекаємо на вибір
    void start({
      mode,
      slugs: slugsKey ? slugsKey.split(",") : null,
      difficulty: chosenDifficulty ?? "normal",
    });
  }, [start, mode, slugsKey, needsDifficulty, chosenDifficulty]);

  // Промах: пауза, щоб гравець побачив картку там, де поклав (червона,
  // з роком), і лише потім вона переїжджає на правильне місце
  const relocating = useGame((s) => s.relocating);
  const finishRelocation = useGame((s) => s.finishRelocation);
  useEffect(() => {
    if (!relocating) return;
    const t = window.setTimeout(finishRelocation, 1300);
    return () => window.clearTimeout(t);
  }, [relocating, finishRelocation]);

  // Екран завершення — з паузою, щоб гравець встиг побачити анімацію
  // останньої помилки (трясіння картки + згасання прапорця)
  const [overShown, setOverShown] = useState(false);
  useEffect(() => {
    if (status !== "over") {
      setOverShown(false);
      return;
    }
    const t = window.setTimeout(
      () => setOverShown(true),
      lastMove?.correct ? 400 : 1100,
    );
    return () => window.clearTimeout(t);
  }, [status, lastMove]);

  // Прогріваємо кеш браузера зображеннями найближчих карток колоди
  const deck = useGame((s) => s.deck);
  useEffect(() => {
    for (const card of deck.slice(0, 3)) {
      if (card.image) new window.Image().src = imageUrl(card.image);
    }
  }, [deck]);

  if (needsDifficulty && !chosenDifficulty) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ⬅️ Вийти
          </Link>
          <ThemeSwitcher />
        </header>
        <DifficultySelect onPick={setChosenDifficulty} />
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Завантаження карток…
      </div>
    );
  }

  const statusSlot = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-accent-soft-foreground shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
            Рахунок
          </span>
          <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
            {score}
          </span>
        </span>
        {mode !== "daily" && (
          <span className="flex items-center gap-2 rounded-full bg-warning-soft px-4 py-1.5 text-warning-soft-foreground shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">
              🏆 Рекорд
            </span>
            <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
              {best}
            </span>
          </span>
        )}
      </div>
      {mode === "daily" ? (
        <p className="text-lg font-semibold">
          Картка {Math.min(moves.length + 1, totalToPlace)} з {totalToPlace}
        </p>
      ) : (
        <Lives lives={lives} />
      )}
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <DebugPanel />
      {howToOpen && <HowToPlayModal onClose={closeHowTo} />}
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ⬅️ Вийти
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label="Як грати"
            onClick={() => setHowToOpen(true)}
          >
            ?
          </Button>
          {categoryName && (
            <Chip color="accent" className="max-w-56 truncate">
              {categoryName}
            </Chip>
          )}
          {difficulty !== "normal" && (
            <Chip color="accent">
              {difficultyMeta(difficulty).icon} {difficultyMeta(difficulty).label}
            </Chip>
          )}
          <ThemeSwitcher />
        </div>
      </header>

      {status === "over" && overShown ? (
        mode === "daily" ? (
          <DailyResultView />
        ) : (
          <GameOver />
        )
      ) : (
        <BoardProvider
          value={{ timeline, current, lastMove, canAct: true, place }}
        >
          <BoardCore topSlot={statusSlot} />
        </BoardProvider>
      )}
    </div>
  );
}
