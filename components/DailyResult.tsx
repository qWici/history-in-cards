"use client";

import { Button, buttonVariants } from "@heroui/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readDailyResult, shareText, type DailyResult } from "@/lib/daily";

export function DailyResultView() {
  const [result, setResult] = useState<DailyResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setResult(readDailyResult());
  }, []);

  if (!result) return null;

  async function share() {
    if (!result) return;
    const text = shareText(result);
    // Системне вікно шеру — тільки на тач-пристроях; на десктопі
    // (точний курсор) одразу копіюємо в буфер
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (isTouchDevice && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* користувач скасував — падаємо в копіювання */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const [y, m, d] = result.date.split("-");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <h2 className="text-3xl font-bold">Щоденний виклик</h2>
      <p className="text-sm text-muted">
        {d}.{m}.{y} · нова колода — щодня опівночі за Києвом
      </p>
      <p className="text-2xl tracking-wider">{result.emoji}</p>
      <p className="text-4xl font-extrabold tabular-nums">
        {result.score}/{result.total}
      </p>
      {result.streak > 1 && (
        <p className="text-lg font-semibold">🔥 Серія: {result.streak} дн.</p>
      )}
      <div className="flex gap-3">
        <Button variant="primary" onClick={share}>
          {copied ? "Скопійовано ✓" : "Поділитися"}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          На головну
        </Link>
      </div>
    </div>
  );
}
