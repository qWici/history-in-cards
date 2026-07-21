"use client";

import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "@/components/CardModal";
import { GameCardView } from "@/components/GameCard";
import type { CategoryInfo, GameCard } from "@/lib/types";

const PAGE = 60;

export function CardLibrary() {
  const [pool, setPool] = useState<GameCard[] | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [selected, setSelected] = useState<GameCard | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/all.json").then((r) => r.json()),
      fetch("/data/manifest.json").then((r) => r.json()),
    ])
      .then(([cards, manifest]) => {
        setPool(cards as GameCard[]);
        setCategories(manifest as CategoryInfo[]);
      })
      .catch(() => setPool([]));
  }, []);

  const filtered = useMemo(() => {
    if (!pool) return [];
    const q = query.trim().toLowerCase();
    const from = yearFrom === "" ? -Infinity : Number(yearFrom);
    const to = yearTo === "" ? Infinity : Number(yearTo);
    return pool
      .filter(
        (c) =>
          (cat === "all" || c.category === cat) &&
          c.year >= from &&
          c.year <= to &&
          (!q || c.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.year - b.year);
  }, [pool, query, cat, yearFrom, yearTo]);

  // нові фільтри — починаємо список спочатку
  useEffect(() => setVisible(PAGE), [query, cat, yearFrom, yearTo]);

  if (pool === null) {
    return <p className="text-center text-muted">Завантаження карток…</p>;
  }

  const input =
    "h-10 rounded-lg border border-border bg-background-secondary px-3 text-sm outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          type="search"
          placeholder="Пошук за назвою…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${input} w-56`}
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className={`${input} max-w-64`}
          aria-label="Категорія"
        >
          <option value="all">Всі категорії</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} · {c.count}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Рік від"
          value={yearFrom}
          onChange={(e) => setYearFrom(e.target.value)}
          className={`${input} w-24`}
          aria-label="Рік від"
        />
        <input
          type="number"
          placeholder="Рік до"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
          className={`${input} w-24`}
          aria-label="Рік до"
        />
      </div>

      <p className="text-center text-sm text-muted">
        Знайдено карток: {filtered.length}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {filtered.slice(0, visible).map((card) => (
          <button
            key={`${card.qid}-${card.year}`}
            type="button"
            onClick={() => setSelected(card)}
            className="cursor-pointer transition-transform hover:-translate-y-1"
          >
            <GameCardView card={card} showYear />
          </button>
        ))}
      </div>

      {filtered.length > visible && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
            Показати ще ({filtered.length - visible})
          </Button>
        </div>
      )}

      {selected && (
        <CardModal card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
