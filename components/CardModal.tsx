"use client";

import { buttonVariants } from "@heroui/react";
import { useEffect } from "react";
import type { GameCard } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { formatYear, imageUrl, wikiUrl } from "@/lib/game";

interface Props {
  card: GameCard;
  onClose: () => void;
}

export function CardModal({ card, onClose }: Props) {
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
          <div className="h-[308px] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(card.image)}
              alt=""
              className="h-full w-full object-cover object-top"
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
            <span className="shrink-0 rounded-full bg-accent-soft px-3 py-0.5 text-base font-bold tabular-nums text-accent-soft-foreground">
              {formatYear(card.year)}
            </span>
          </div>
          {(card.fact ?? card.subtitle) && (
            <p className="text-sm leading-relaxed text-muted">
              {card.fact ?? card.subtitle}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1">
            <a
              href={wikiUrl(card.wikipediaSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              Читати у Вікіпедії ↗
            </a>
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
