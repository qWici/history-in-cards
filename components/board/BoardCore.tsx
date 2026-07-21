"use client";

/**
 * Ігрове ядро, відв'язане від zustand-стору: всі компоненти читають стан
 * із BoardContext. Соло-гра постачає контекст зі стору, мультиплеєр —
 * зі снапшотів сервера. UI і взаємодії (drag, фліп, автоскрол) спільні.
 */

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CardBack, GameCardView } from "@/components/GameCard";
import { CardModal } from "@/components/CardModal";
import { formatYear, imageUrl } from "@/lib/game";
import type { GameCard, PlacedCard } from "@/lib/types";

export interface BoardMove {
  qid: string;
  correct: boolean;
  title: string;
  year: number;
}

export interface BoardContextValue {
  timeline: PlacedCard[];
  current: GameCard | null;
  lastMove: BoardMove | null;
  /** Чи може цей клієнт зараз ходити (соло: завжди; мульти: мій хід). */
  canAct: boolean;
  place: (index: number) => void;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard поза <BoardProvider>");
  return ctx;
}

export function BoardProvider({
  value,
  children,
}: {
  value: BoardContextValue;
  children: ReactNode;
}) {
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/** Вигнута стрілка вниз — підказує, що картку тягнуть на таймлайн. */
function ArrowToTimeline() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 4c-8 1-11 6-11 13" />
      <path d="M3.5 14 7 17.5 10.5 14" />
    </svg>
  );
}

function DraggableCurrent({
  returning,
  onPreview,
}: {
  returning: boolean;
  onPreview: () => void;
}) {
  const { current, canAct } = useBoard();
  // Нова картка приходить сорочкою догори; перевертаємо, коли її зображення
  // довантажилось. Зберігаємо QID перевернутої картки (не boolean!): нова
  // картка вже на першому рендері «не перевернута» — без ефектів-скидань,
  // які давали видимий розворот туди-назад.
  const [revealedQid, setRevealedQid] = useState<string | null>(null);
  const revealed = !!current && revealedQid === current.qid;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "current",
    disabled: !revealed || !canAct,
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

  if (!current) {
    return (
      <div className="relative">
        <div className="absolute left-1.5 top-1.5" aria-hidden>
          <CardBack className="opacity-50" />
        </div>
        <CardBack />
      </div>
    );
  }
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
        onClick={() => revealed && onPreview()}
        className={`flip-scene relative touch-none ${
          revealed && canAct ? "cursor-grab active:cursor-grabbing" : ""
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
  const { place, timeline, canAct } = useBoard();
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${index}`,
    disabled: !canAct,
  });
  // крайні слоти світяться й тоді, коли картка над сусідньою крайовою зоною
  const { over } = useDndContext();
  const edgeOver =
    (over?.id === "edge-left" && index === 0) ||
    (over?.id === "edge-right" && index === timeline.length);
  const highlighted = isOver || edgeOver;
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`Покласти картку в позицію ${index + 1}`}
      onClick={() => canAct && place(index)}
      className={`mx-1.5 h-56 shrink-0 self-center rounded-lg border-2 border-dashed transition-all sm:mx-2 sm:h-60 short:h-48! ${
        highlighted
          ? "w-24 border-accent bg-accent-soft"
          : active
            ? "w-12 border-border hover:border-accent hover:bg-accent-soft/40"
            : "w-6 border-transparent hover:border-border"
      }`}
    />
  );
}

/**
 * Крайова зона таймлайна: весь порожній простір зліва/справа від карток —
 * велика мішень, що кладе картку на початок або кінець лінії часу.
 */
function EdgeZone({ side }: { side: "left" | "right" }) {
  const { place, timeline, canAct } = useBoard();
  const { setNodeRef } = useDroppable({
    id: `edge-${side}`,
    disabled: !canAct,
  });
  const index = side === "left" ? 0 : timeline.length;
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={
        side === "left"
          ? "Покласти картку на початок лінії часу"
          : "Покласти картку в кінець лінії часу"
      }
      onClick={() => canAct && place(index)}
      className="min-w-3 flex-1 self-stretch"
    />
  );
}

function Timeline({ active }: { active: boolean }) {
  const { timeline, lastMove } = useBoard();
  const [selected, setSelected] = useState<PlacedCard | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { active: dragActive } = useDndContext();

  // Автоскрол при перетягуванні: чим ближче курсор до краю таймлайна,
  // тим швидше скрол (квадратична крива). Вбудований автоскрол dnd-kit
  // тут не працює — картка не є нащадком скрол-контейнера.
  useEffect(() => {
    const el = scrollRef.current;
    if (!dragActive || !el) return;
    const EDGE = 160; // px від краю, де вмикається скрол
    const MAX_SPEED = 24; // px за кадр біля самого краю
    let pointerX: number | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pointerX = e.clientX;
    };
    const prevBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto"; // smooth ламає покадровий скрол
    const tick = () => {
      if (pointerX !== null) {
        const rect = el.getBoundingClientRect();
        const fromLeft = pointerX - rect.left;
        const fromRight = rect.right - pointerX;
        if (fromLeft < EDGE && fromLeft > -40) {
          const k = (EDGE - Math.max(fromLeft, 0)) / EDGE;
          el.scrollLeft -= MAX_SPEED * k * k;
        } else if (fromRight < EDGE && fromRight > -40) {
          const k = (EDGE - Math.max(fromRight, 0)) / EDGE;
          el.scrollLeft += MAX_SPEED * k * k;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      el.style.scrollBehavior = prevBehavior;
    };
  }, [dragActive]);

  useEffect(() => {
    if (!lastMove || !scrollRef.current) return;
    scrollRef.current
      .querySelector(`[data-qid="${lastMove.qid}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [lastMove, timeline]);

  return (
    <div
      ref={scrollRef}
      className="timeline-scroll flex w-full items-stretch overflow-x-auto px-4 py-3"
    >
      <EdgeZone side="left" />
      <div className="flex items-stretch">
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
      <EdgeZone side="right" />
      {selected && (
        <CardModal card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/**
 * Центральна ігрова зона: статус-слот, колода з активною карткою,
 * підказки, банер промаху, таймлайн, прев'ю і drag-механіка.
 */
export function BoardCore({ topSlot }: { topSlot?: ReactNode }) {
  const { current, lastMove, place, timeline, canAct } = useBoard();
  const [dragging, setDragging] = useState(false);
  const [returning, setReturning] = useState(false);
  // Прев'ю активної картки (рік прихований); guard відсікає клік,
  // що прилітає одразу після завершення перетягування
  const [previewOpen, setPreviewOpen] = useState(false);
  const lastDragEndAt = useRef(0);
  // «Знімок» картки для DragOverlay: живе до кінця drop-анімації,
  // інакше overlay зникає в момент відпускання і політ назад не грає
  const [dragCard, setDragCard] = useState<GameCard | null>(null);
  const droppedOnSlot = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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
    lastDragEndAt.current = Date.now();
    const over = event.over?.id;
    // дроп на слот або на крайову зону (порожній простір обабіч карток)
    const slotIndex =
      typeof over === "string" && over.startsWith("slot-")
        ? Number(over.slice(5))
        : over === "edge-left"
          ? 0
          : over === "edge-right"
            ? timeline.length
            : null;
    if (slotIndex !== null) {
      droppedOnSlot.current = true;
      place(slotIndex);
      setDragCard(null); // успіх: картка вже в таймлайні, політ назад не потрібен
    } else {
      setReturning(true); // сорочку видно, доки dropAnimation не завершиться
    }
  }

  return (
    <DndContext
      sensors={sensors}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
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
        {topSlot && (
          <div className="flex flex-col items-center gap-[clamp(0.5rem,3vh,2.5rem)] mb-[clamp(0.5rem,3vh,2.5rem)]">
            {topSlot}
          </div>
        )}
        <div className="relative">
          <DraggableCurrent
            returning={returning}
            onPreview={() => {
              if (Date.now() - lastDragEndAt.current > 350) {
                setPreviewOpen(true);
              }
            }}
          />
          {/* стрілки-підказки обабіч картки: тягнути вниз, на таймлайн */}
          <div className="absolute -left-16 bottom-0 text-muted" aria-hidden>
            <ArrowToTimeline />
          </div>
          <div
            className="absolute -right-16 bottom-0 -scale-x-100 text-muted"
            aria-hidden
          >
            <ArrowToTimeline />
          </div>
        </div>
        <p className="px-4 text-center text-xs leading-relaxed text-muted short:hidden">
          Перетягни картку на лінію часу
          <br />
          або натисни на місце між картками
        </p>
        {lastMove && !lastMove.correct && (
          <div className="rounded-full bg-danger-soft px-5 py-2 text-sm font-semibold text-danger-soft-foreground">
            Промах! «{lastMove.title}» — {formatYear(lastMove.year)}
          </div>
        )}
        <section
          aria-label="Лінія часу"
          className="mt-[50px] w-full rounded-2xl bg-background-secondary/40 short:mt-2!"
        >
          <Timeline active={canAct && (dragging || !!current)} />
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
      {previewOpen && current && (
        <CardModal card={current} hideYear onClose={() => setPreviewOpen(false)} />
      )}
      <DragOverlay dropAnimation={dropAnimation}>
        {dragCard ? (
          <GameCardView card={dragCard} showYear={false} className="rotate-2" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
