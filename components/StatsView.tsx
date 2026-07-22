"use client";

import { useEffect, useState } from "react";
import { DIFFICULTIES } from "@/lib/difficulty";

interface Stats {
  games: Record<string, number>;
  /** classic / classic:easy / classic:hard / classic:historian / category / daily */
  hist: Record<string, Record<string, number>>;
  moves: Record<string, number>;
}

/** Гістограма рівня складності: «звичайний» — легасі-ключ hist.classic. */
function classicHistKey(id: string): string {
  return id === "normal" ? "classic" : `classic:${id}`;
}

/** Гістограма розподілу рахунків: одна серія — акцентний колір системи. */
function Histogram({
  data,
  maxX,
}: {
  data: Record<string, number>;
  maxX?: number;
}) {
  const entries = Object.entries(data).map(([k, v]) => [Number(k), Number(v)]);
  if (!entries.length) {
    return <p className="text-sm text-muted">Ще немає зіграних ігор.</p>;
  }
  const top = maxX ?? Math.max(...entries.map(([s]) => s));
  const counts = Array.from({ length: top + 1 }, (_, s) => {
    const found = entries.find(([score]) => score === s);
    return found ? found[1] : 0;
  });
  const maxCount = Math.max(...counts);
  const peak = counts.indexOf(maxCount);

  return (
    <div>
      {/* верхній відступ під підпис піку (-top-5 над стовпчиком на всю висоту) */}
      <div className="mt-6 flex h-40 items-end gap-[2px]">
        {counts.map((count, score) => (
          <div
            key={score}
            title={`Рахунок ${score}: ${count} ${count === 1 ? "гра" : "ігор"}`}
            className="group relative flex-1 rounded-t-[4px] bg-accent transition-opacity hover:opacity-80"
            style={{
              height: `${maxCount ? Math.max((count / maxCount) * 100, count ? 3 : 0) : 0}%`,
              minWidth: 6,
            }}
          >
            {/* прямий підпис лише на піку — решта у ховер-тултіпі */}
            {score === peak && count > 0 && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold tabular-nums">
                {count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-border pt-1">
        {counts.map((_, score) => (
          <span
            key={score}
            className="flex-1 text-center text-[10px] tabular-nums text-muted"
            style={{ minWidth: 6 }}
          >
            {top <= 14 || score % 5 === 0 ? score : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-background-secondary px-6 py-4 text-center">
      <span className="text-3xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState<Stats | null | "loading" | "error">(
    "loading",
  );

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setStats("error"));
  }, []);

  if (stats === "loading") {
    return <p className="text-center text-muted">Завантаження…</p>;
  }
  if (stats === "error" || stats === null) {
    return (
      <p className="text-center text-muted">
        Статистика тимчасово недоступна.
      </p>
    );
  }

  const totalGames = Object.values(stats.games).reduce((a, b) => a + Number(b), 0);
  const merged: Record<string, number> = {};
  for (const hist of [
    ...DIFFICULTIES.map((o) => stats.hist[classicHistKey(o.id)]),
    stats.hist.category,
  ]) {
    for (const [score, count] of Object.entries(hist ?? {})) {
      merged[score] = (merged[score] ?? 0) + Number(count);
    }
  }
  // рівні з хоч однією зіграною партією — для розбивки за складністю
  const playedLevels = DIFFICULTIES.filter((o) =>
    Object.keys(stats.hist[classicHistKey(o.id)] ?? {}).length > 0,
  );
  const best = Object.keys(merged).length
    ? Math.max(...Object.keys(merged).map(Number))
    : 0;
  const correct = Number(stats.moves.correct ?? 0);
  const wrong = Number(stats.moves.wrong ?? 0);
  const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Зіграно ігор" value={String(totalGames)} />
        <StatTile label="Найбільший рахунок" value={String(best)} />
        <StatTile label="Точність ходів" value={`${accuracy}%`} />
        <StatTile label="Розкладено карток" value={String(correct + wrong)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          Розподіл рахунків — класика та категорії
        </h2>
        <Histogram data={merged} />
      </section>

      {playedLevels.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-bold">Класика за складністю</h2>
          <p className="mb-4 text-xs text-muted">
            Партії, зіграні до появи рівнів, враховано у «Звичайному» — вони
            гралися саме цією колодою.
          </p>
          <div className="flex flex-col gap-6">
            {playedLevels.map((o) => {
              const hist = stats.hist[classicHistKey(o.id)] ?? {};
              const count = Object.values(hist).reduce(
                (a, b) => a + Number(b),
                0,
              );
              return (
                <div key={o.id}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {o.icon} {o.label}{" "}
                    <span className="font-normal text-muted">
                      — {count} {count === 1 ? "гра" : "ігор"}
                    </span>
                  </h3>
                  <Histogram data={hist} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Щоденний виклик — з 12 карток</h2>
        <Histogram data={stats.hist.daily ?? {}} maxX={12} />
      </section>

      <p className="text-center text-xs text-muted">
        Ігор у класиці: {Number(stats.games.classic ?? 0)} · за категоріями:{" "}
        {Number(stats.games.category ?? 0)} · щоденних:{" "}
        {Number(stats.games.daily ?? 0)}. Оновлюється щохвилини.
      </p>
    </div>
  );
}
