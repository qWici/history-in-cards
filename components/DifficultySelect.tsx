"use client";

import { useEffect, useState } from "react";
import type { Difficulty } from "@/lib/game";
import {
  DIFFICULTIES,
  readDifficulty,
  saveDifficulty,
} from "@/lib/difficulty";
import { bestKey } from "@/lib/store";

/**
 * Екран вибору складності перед стартом класичної гри: чотири великі
 * картки з описом і особистим рекордом рівня. Останній обраний рівень
 * підсвічений; клік одразу починає партію.
 */
export function DifficultySelect({
  onPick,
}: {
  onPick: (difficulty: Difficulty) => void;
}) {
  // рекорди й останній вибір — з localStorage, тільки після маунта (SSR-safe)
  const [bests, setBests] = useState<Partial<Record<Difficulty, number>>>({});
  const [last, setLast] = useState<Difficulty | null>(null);

  useEffect(() => {
    setLast(readDifficulty());
    setBests(
      Object.fromEntries(
        DIFFICULTIES.map((o) => [
          o.id,
          Number(localStorage.getItem(bestKey(o.id)) ?? 0),
        ]),
      ),
    );
  }, []);

  function pick(id: Difficulty) {
    saveDifficulty(id);
    onPick(id);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16">
      <h2 className="text-3xl font-bold">Обери складність</h2>
      <div
        className="flex w-full max-w-md flex-col gap-3"
        role="radiogroup"
        aria-label="Складність"
      >
        {DIFFICULTIES.map((o) => {
          const active = o.id === last;
          const best = bests[o.id] ?? 0;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(o.id)}
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-background"
              }`}
            >
              <span className="text-3xl" aria-hidden>
                {o.icon}
              </span>
              <span className="flex-1">
                <span className="block text-lg font-bold">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </span>
              {best > 0 && (
                <span
                  className="shrink-0 rounded-full bg-warning-soft px-2.5 py-0.5 text-sm font-semibold tabular-nums text-warning-soft-foreground"
                  title="Твій рекорд на цьому рівні"
                >
                  🏆 {best}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
