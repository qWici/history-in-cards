"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { Button, buttonVariants, Chip } from "@heroui/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CardBack, GameCardView } from "@/components/GameCard";
import { CardModal } from "@/components/CardModal";
import { DailyResultView } from "@/components/DailyResult";
import type { GameMode } from "@/lib/store";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { formatYear, imageUrl } from "@/lib/game";
import { LIVES, useGame } from "@/lib/store";

function Lives({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Життя: ${lives} з ${LIVES}`}>
      {Array.from({ length: LIVES }, (_, i) => (
        <span
          key={i}
          className={`text-2xl transition-all sm:text-3xl short:text-xl! ${
            i < lives ? "" : "opacity-25 grayscale"
          }`}
        >
          🇺🇦
        </span>
      ))}
    </div>
  );
}

function DraggableCurrent({ returning }: { returning: boolean }) {
  const current = useGame((s) => s.current);
  // Нова картка приходить сорочкою догори; перевертаємо, коли її зображення
  // довантажилось. Зберігаємо QID перевернутої картки (не boolean!): нова
  // картка вже на першому рендері «не перевернута» — без ефектів-скидань,
  // які давали видимий розворот туди-назад.
  const [revealedQid, setRevealedQid] = useState<string | null>(null);
  const revealed = !!current && revealedQid === current.qid;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "current",
    disabled: !revealed,
  });

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    let minDelay: number | undefined;
    const reveal = () => {
      if (!cancelled) setRevealedQid(current.qid);
    };
    // фолбек: перевертаємо максимум за 2.5с, навіть якщо CDN гальмує
    const fallback = window.setTimeout(reveal, current.image ? 2500 : 200);
    if (current.image) {
      const img = new window.Image();
      // 150мс після завантаження — щоб фліп було видно й на кешованих фото
      img.onload = () => {
        minDelay = window.setTimeout(reveal, 150);
      };
      img.onerror = reveal;
      img.src = imageUrl(current.image);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      window.clearTimeout(minDelay);
    };
  }, [current]);

  if (!current) return null;
  // «Колода»: сорочка лежить під карткою ЗАВЖДИ (визирає знизу-праворуч).
  // Поки картку тягнуть чи вона летить назад — верхня картка прозора,
  // і видно колоду. Рух самої картки малює DragOverlay.
  return (
    <div className="relative">
      <div className="absolute left-1.5 top-1.5" aria-hidden>
        <CardBack className="opacity-50" />
      </div>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`flip-scene relative touch-none ${
          revealed ? "cursor-grab active:cursor-grabbing" : ""
        } ${isDragging || returning ? "opacity-0" : ""}`}
      >
        {/* key: нова картка = новий вузол, що народжується сорочкою догори —
            без видимого зворотного розвороту попередньої */}
        <div
          key={current.qid}
          className={`flip-inner ${revealed ? "is-flipped" : ""}`}
        >
          <div className="flip-face">
            <CardBack />
          </div>
          <div className="flip-face flip-front">
            <GameCardView card={current} showYear={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DropSlot({ index, active }: { index: number; active: boolean }) {
  const place = useGame((s) => s.place);
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`Покласти картку в позицію ${index + 1}`}
      onClick={() => place(index)}
      className={`mx-1.5 h-56 shrink-0 self-center rounded-lg border-2 border-dashed transition-all sm:mx-2 sm:h-60 short:h-48! ${
        isOver
          ? "w-24 border-accent bg-accent-soft"
          : active
            ? "w-12 border-border hover:border-accent hover:bg-accent-soft/40"
            : "w-6 border-transparent hover:border-border"
      }`}
    />
  );
}

function Timeline({ active }: { active: boolean }) {
  const timeline = useGame((s) => s.timeline);
  const lastMove = useGame((s) => s.lastMove);
  const [selected, setSelected] = useState<(typeof timeline)[number] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMove || !scrollRef.current) return;
    scrollRef.current
      .querySelector(`[data-qid="${lastMove.qid}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [lastMove, timeline.length]);

  return (
    <div
      ref={scrollRef}
      className="timeline-scroll flex w-full items-stretch overflow-x-auto px-4 py-3"
    >
      <div className="mx-auto flex items-stretch">
        <DropSlot index={0} active={active} />
        {timeline.map((card, i) => (
          <div key={`${card.qid}-${card.year}`} className="flex items-stretch">
            <div
              data-qid={card.qid}
              role="button"
              tabIndex={0}
              aria-label={`Докладніше: ${card.title}`}
              onClick={() => setSelected(card)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(card)}
              className={`cursor-pointer transition-transform hover:-translate-y-1 ${
                lastMove?.qid === card.qid
                  ? lastMove.correct
                    ? "card-slide-in"
                    : "card-shake"
                  : ""
              }`}
            >
              <GameCardView
                card={card}
                showYear
                correct={lastMove?.qid === card.qid ? lastMove.correct : undefined}
              />
            </div>
            <DropSlot index={i + 1} active={active} />
          </div>
        ))}
      </div>
      {selected && (
        <CardModal card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function GameOver() {
  const { score, best, timeline, start } = useGame();
  const [selected, setSelected] = useState<(typeof timeline)[number] | null>(null);
  const isRecord = score > 0 && score >= best;
  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <h2 className="text-3xl font-bold">Гру завершено</h2>
      <div className="flex items-center gap-3">
        <Chip color="accent" size="lg">
          Рахунок: {score}
        </Chip>
        <Chip color={isRecord ? "success" : "default"} size="lg">
          {isRecord ? "🏆 Новий рекорд!" : `Рекорд: ${best}`}
        </Chip>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => start()}>
          Зіграти ще раз
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
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
  const { status, lives, score, best, current, start, place, moves, totalToPlace } =
    useGame();
  const [dragging, setDragging] = useState(false);
  const [returning, setReturning] = useState(false);
  // «Знімок» картки для DragOverlay: живе до кінця drop-анімації,
  // інакше overlay зникає в момент відпускання і політ назад не грає
  const [dragCard, setDragCard] = useState<typeof current>(null);
  const droppedOnSlot = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Кожен захід на сторінку гри — нова партія (стор глобальний і переживає
  // навігацію, інакше після «Вийти» тут висів би стан попередньої гри)
  const slugsKey = slugs?.join(",") ?? "";
  useEffect(() => {
    void start({ mode, slugs: slugsKey ? slugsKey.split(",") : null });
  }, [start, mode, slugsKey]);

  // Прогріваємо кеш браузера зображеннями найближчих карток колоди
  const deck = useGame((s) => s.deck);
  useEffect(() => {
    for (const card of deck.slice(0, 3)) {
      if (card.image) new window.Image().src = imageUrl(card.image);
    }
  }, [deck]);

  // Кастомна drop-анімація: при успішному дропі польоту назад немає;
  // при невдалому — самі анімуємо overlay до колоди і по завершенню
  // (точний момент приземлення) показуємо картку знову.
  const dropAnimation: DropAnimation = ({ dragOverlay, transform }) => {
    if (droppedOnSlot.current) return;
    const animation = dragOverlay.node.animate(
      [
        { transform: `translate(${transform.x}px, ${transform.y}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.3, 1.1)" },
    );
    return animation.finished.then(() => {
      setReturning(false);
      setDragCard(null);
    });
  };

  function onDragEnd(event: DragEndEvent) {
    setDragging(false);
    const over = event.over?.id;
    if (typeof over === "string" && over.startsWith("slot-")) {
      droppedOnSlot.current = true;
      place(Number(over.slice(5)));
      setDragCard(null); // успіх: картка вже в таймлайні, політ назад не потрібен
    } else {
      setReturning(true); // сорочку видно, доки dropAnimation не завершиться
    }
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Завантаження карток…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ⬅️ Вийти
        </Link>
        <div className="flex items-center gap-3">
          {categoryName && (
            <Chip color="accent" className="max-w-56 truncate">
              {categoryName}
            </Chip>
          )}
          <ThemeSwitcher />
        </div>
      </header>

      {status === "over" ? (
        mode === "daily" ? (
          <DailyResultView />
        ) : (
          <GameOver />
        )
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={() => {
            droppedOnSlot.current = false;
            setDragging(true);
            setDragCard(current);
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(false);
            setReturning(true);
          }}
        >
          {/* Все по центру: картка, підказка і одразу під ними — лінія часу */}
          <main className="flex flex-1 flex-col items-center justify-center-safe gap-3 pb-6">
            <div className="flex flex-col items-center gap-1.5 mb-[clamp(0.5rem,8vh,7rem)]">
              {mode === "daily" ? (
                <p className="text-lg font-semibold">
                  Картка {Math.min(moves.length + 1, totalToPlace)} з {totalToPlace}
                </p>
              ) : (
                <Lives lives={lives} />
              )}
              <div className="flex items-center gap-2">
                <span className="flex items-baseline gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-accent-soft-foreground shadow-sm">
                  <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                    Рахунок
                  </span>
                  <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
                    {score}
                  </span>
                </span>
                {mode !== "daily" && (
                  <span className="flex items-baseline gap-2 rounded-full bg-warning-soft px-4 py-1.5 text-warning-soft-foreground shadow-sm">
                    <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                      🏆 Рекорд
                    </span>
                    <span className="text-xl font-extrabold tabular-nums sm:text-2xl">
                      {best}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {current && (
              <>
                <DraggableCurrent returning={returning} />
                <p className="px-4 text-center text-xs leading-relaxed text-muted short:hidden">
                  Перетягни картку на лінію часу
                  <br />
                  або натисни на місце між картками
                </p>
              </>
            )}
            <section
              aria-label="Лінія часу"
              className="mt-[50px] w-full rounded-2xl bg-background-secondary/40 short:mt-2!"
            >
              <Timeline active={dragging || !!current} />
            </section>
            <div className="flex items-center gap-2 text-muted">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {/* вигнута стрілка вгору, до таймлайна */}
                <path d="M6 20c0-7 3-12 11-13" />
                <path d="M13 4.5 17.5 7 15 11.5" />
              </svg>
              <p className="text-xs">
                Натисни на картку в таймлайні, щоб дізнатись більше про подію
              </p>
            </div>
          </main>
          <DragOverlay dropAnimation={dropAnimation}>
            {dragCard ? (
              <GameCardView card={dragCard} showYear={false} className="rotate-2" />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
