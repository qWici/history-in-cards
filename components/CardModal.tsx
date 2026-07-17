"use client";

import { buttonVariants } from "@heroui/react";
import { useEffect } from "react";
import type { GameCard } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { formatYear, imageUrl, wikiUrl } from "@/lib/game";

interface Props {
  card: GameCard;
  onClose: () => void;
  /** Режим для ще не розміщеної картки: рік і всі підказки на нього приховані. */
  hideYear?: boolean;
}

/** Маскує роки в тексті: «27 червня 1709 року» -> «27 червня ···· року». */
function maskYears(text: string): string {
  return text.replace(/\b\d{3,4}\b/g, "····");
}

export function CardModal({ card, onClose, hideYear = false }: Props) {
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
        className="card-slide-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {card.image && (
          <div className="h-[308px] w-full overflow-hidden bg-background-tertiary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(card.image)}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        )}
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
              onClick={onClose}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
