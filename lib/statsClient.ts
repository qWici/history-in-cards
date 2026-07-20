/** Надсилає результат партії у публічну статистику (fire-and-forget). */
export function reportGameResult(
  mode: "classic" | "category" | "daily",
  score: number,
  correct: number,
  wrong: number,
) {
  try {
    fetch("/api/stats", {
      method: "POST",
      keepalive: true, // доживає навіть якщо вкладку закривають
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, score, correct, wrong }),
    }).catch(() => {});
  } catch {
    /* статистика ніколи не має ламати гру */
  }
}
