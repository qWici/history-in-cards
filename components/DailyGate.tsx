"use client";

import { buttonVariants } from "@heroui/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DailyResultView } from "@/components/DailyResult";
import { GameBoard } from "@/components/GameBoard";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { readDailyResult } from "@/lib/daily";
import { kyivToday } from "@/lib/game";

/** Одна спроба на день: якщо сьогодні вже зіграно — показуємо результат. */
export function DailyGate() {
  const [played, setPlayed] = useState<boolean | null>(null);

  useEffect(() => {
    setPlayed(readDailyResult()?.date === kyivToday());
  }, []);

  if (played === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Завантаження…
      </div>
    );
  }

  if (played) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ⬅️ Вийти
          </Link>
          <ThemeSwitcher />
        </header>
        <DailyResultView />
      </div>
    );
  }

  return <GameBoard mode="daily" categoryName="Щоденний виклик" />;
}
