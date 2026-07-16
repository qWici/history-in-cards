import { kyivToday, prevDay } from "./game";

const DAILY_KEY = "ua-trivia:daily";

export interface DailyResult {
  date: string; // YYYY-MM-DD (Київ)
  score: number;
  total: number;
  emoji: string; // 🟩🟥... по картках у порядку ходів
  streak: number; // серія зіграних днів поспіль
}

export function readDailyResult(): DailyResult | null {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    return raw ? (JSON.parse(raw) as DailyResult) : null;
  } catch {
    return null;
  }
}

/** Зберігає результат сьогоднішнього виклику, рахуючи серію днів. */
export function saveDailyResult(score: number, total: number, emoji: string): DailyResult {
  const today = kyivToday();
  const prev = readDailyResult();
  const streak = prev && prev.date === prevDay(today) ? prev.streak + 1 : 1;
  const result: DailyResult = { date: today, score, total, emoji, streak };
  localStorage.setItem(DAILY_KEY, JSON.stringify(result));
  return result;
}

export function shareText(r: DailyResult): string {
  const [y, m, d] = r.date.split("-");
  const lines = [
    `Історія в картках — щоденний виклик ${d}.${m}.${y}`,
    `${r.emoji} ${r.score}/${r.total}`,
  ];
  if (r.streak > 1) lines.push(`🔥 Серія: ${r.streak}`);
  lines.push(typeof window !== "undefined" ? `${window.location.origin}/daily` : "");
  return lines.join("\n");
}
