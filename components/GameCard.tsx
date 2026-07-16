"use client";

import type { GameCard as GameCardType } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { formatYear, imageUrl } from "@/lib/game";

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background-tertiary text-muted">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {/* стилізований тризуб */}
        <path d="M11 3h2v14.2l3-1.7V6h2v11l-5 3-5-3V6h2v9.5l3 1.7V3Z" opacity=".7" />
      </svg>
    </div>
  );
}

/** «Сорочка» карти — показується на місці картки, поки її тягнуть. */
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-64 w-44 shrink-0 select-none items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-accent-soft shadow-inner sm:h-72 sm:w-52 ${className}`}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-accent-soft-foreground opacity-30"
        aria-hidden
      >
        <path d="M11 3h2v14.2l3-1.7V6h2v11l-5 3-5-3V6h2v9.5l3 1.7V3Z" />
      </svg>
    </div>
  );
}

interface Props {
  card: GameCardType;
  showYear: boolean;
  /** true → підсвітити зеленим, false → червоним, undefined → нейтрально */
  correct?: boolean;
  className?: string;
}

export function GameCardView({ card, showYear, correct, className = "" }: Props) {
  const meta = categoryMeta(card.category);
  const ring =
    correct === undefined
      ? ""
      : correct
        ? "border-green-500/70"
        : "border-red-500/70";
  return (
    <div
      className={`flex h-64 w-44 shrink-0 select-none flex-col overflow-hidden rounded-xl border-2 shadow-md sm:h-72 sm:w-52 ${ring} ${className}`}
      style={{
        // пастельний тінт групи поверх фону теми — працює і в dark, і в light
        background: `color-mix(in oklab, var(--color-background-secondary) 80%, ${meta.color} 20%)`,
        ...(correct === undefined && {
          borderColor: `color-mix(in oklab, var(--color-border) 50%, ${meta.color} 50%)`,
        }),
      }}
    >
      <div className="h-36 w-full overflow-hidden sm:h-40">
        {card.image ? (
          // Спеціально не next/image: Wikimedia CDN сам віддає готові thumbnail'и.
          // object-top: на портретах обличчя зазвичай у верхній частині кадру
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(card.image)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <Placeholder />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-center text-[13px] font-medium leading-snug sm:text-sm">
          {card.title}
        </p>
        <p
          className="truncate text-center text-[11px] font-semibold uppercase tracking-wide opacity-80"
          style={{ color: meta.color }}
        >
          {meta.label}
        </p>
        <p className="mt-auto text-center">
          <span
            className={`inline-block min-w-16 rounded-full px-3 py-0.5 text-base font-bold tabular-nums ${
              showYear
                ? "bg-accent-soft text-accent-soft-foreground"
                : "bg-background-tertiary text-muted"
            }`}
          >
            {showYear ? formatYear(card.year) : "?"}
          </span>
        </p>
      </div>
    </div>
  );
}
