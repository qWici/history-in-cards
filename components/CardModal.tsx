"use client";

import { buttonVariants } from "@heroui/react";
import { useEffect, useState } from "react";
import type { GameCard } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { Placeholder } from "@/components/GameCard";
import { formatYear, imageUrl, wikiUrl } from "@/lib/game";

interface Props {
  card: GameCard;
  onClose: () => void;
  /** Режим для ще не розміщеної картки: рік і всі підказки на нього приховані. */
  hideYear?: boolean;
}

/**
 * Маскує підказки на дату в тексті: роки («1709» -> «····»),
 * століття римськими («XVIII століття» -> «···· століття»)
 * і десятиліття («90-х роках» -> «····-х роках»).
 */
function maskYears(text: string): string {
  return text
    .replace(/\b\d{3,4}\b/g, "····")
    .replace(/\b[IVXХІ]+(?=\s*ст(?:\.|оліт))/g, "····")
    .replace(/\b\d{2}(?=-[хи])/g, "····");
}

const REPORTED_KEY = "ua-trivia:reported";

function readReported(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REPORTED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function CardModal({ card, onClose, hideYear = false }: Props) {
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setReported(readReported().includes(card.qid));
  }, [card.qid]);

  function report() {
    if (reported) return;
    setReported(true);
    localStorage.setItem(
      REPORTED_KEY,
      JSON.stringify([...readReported(), card.qid].slice(-200)),
    );
    fetch("/api/report", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qid: card.qid, title: card.title }),
    }).catch(() => {});
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
    >
      <div
        className="card-slide-in relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[308px] w-full overflow-hidden bg-background-tertiary">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(card.image)}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Placeholder />
          )}
        </div>
        {/* закриття — хрестик у куті */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className="absolute right-3 top-3 cursor-pointer rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="space-y-3 p-5">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: categoryMeta(card.category).color }}
          >
            {categoryMeta(card.category).label}
          </p>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
            <span
              className={`shrink-0 rounded-full px-3 py-0.5 text-base font-bold tabular-nums ${
                hideYear
                  ? "bg-background-tertiary text-muted"
                  : "bg-accent-soft text-accent-soft-foreground"
              }`}
            >
              {hideYear ? "?" : formatYear(card.year)}
            </span>
          </div>
          {(card.fact ?? card.subtitle) && (
            <p className="text-sm leading-relaxed text-muted">
              {hideYear
                ? maskYears((card.fact ?? card.subtitle)!)
                : (card.fact ?? card.subtitle)}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            {hideYear ? (
              <p className="text-xs text-muted">
                Рік і посилання відкриються після розміщення картки
              </p>
            ) : (
              <a
                href={wikiUrl(card.wikipediaSlug)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Читати у Вікіпедії ↗
              </a>
            )}
            <button
              type="button"
              onClick={report}
              disabled={reported}
              aria-label="Повідомити про помилку в картці"
              className={`${buttonVariants({ variant: "ghost", size: "sm" })} ${
                reported ? "opacity-60" : ""
              }`}
            >
              {reported ? (
                "Дякуємо ✓"
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M4 21V4c4-2.5 8 2.5 12 0v9c-4 2.5-8-2.5-12 0" />
                  </svg>
                  Повідомити про помилку
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
