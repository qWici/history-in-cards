"use client";

import { useEffect, useState } from "react";

export function BestScore() {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    setBest(Number(localStorage.getItem("ua-trivia:best") ?? 0));
  }, []);
  if (!best) return null;
  return <p className="text-sm text-muted">Твій рекорд: {best}</p>;
}
