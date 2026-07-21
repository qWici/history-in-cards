"use client";

import { useEffect, useState } from "react";

export function BestScore() {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    setBest(Number(localStorage.getItem("ua-trivia:best") ?? 0));
  }, []);
  if (!best) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3.5 py-1 text-sm font-semibold tabular-nums text-warning-soft-foreground"
      title="Твій рекорд"
    >
      🏆 {best}
    </span>
  );
}
