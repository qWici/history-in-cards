import type { Difficulty } from "./game";

/** Надсилає результат партії у публічну статистику (fire-and-forget). */
export function reportGameResult(
  mode: "classic" | "category" | "daily",
  score: number,
  correct: number,
  wrong: number,
  /** Рівень складності — лише для класики. */
  difficulty?: Difficulty,
) {
  // дебаг-ігри не забруднюють публічну статистику
  if (process.env.NEXT_PUBLIC_DEBUG === "true") return;
  try {
    fetch("/api/stats", {
      method: "POST",
      keepalive: true, // доживає навіть якщо вкладку закривають
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        score,
        correct,
        wrong,
        ...(mode === "classic" && difficulty ? { difficulty } : {}),
      }),
    }).catch(() => {});
  } catch {
    /* статистика ніколи не має ламати гру */
  }
}
