import { Redis } from "@upstash/redis";

// Підтримуємо обидві схеми назв env: Upstash Marketplace і легасі Vercel KV
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const MODES = ["classic", "category", "daily"] as const;
type Mode = (typeof MODES)[number];

// Рівні складності класики. «normal» пише в легасі-ключ hist:classic —
// там же живуть усі партії, зіграні до появи рівнів (та сама крива)
const DIFFICULTIES = ["easy", "normal", "hard", "historian"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const isCount = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 1000;

/** Записує результат завершеної партії. */
export async function POST(req: Request) {
  if (!redis) return Response.json({ ok: false });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { mode, score, correct, wrong, difficulty } = body;
  if (
    typeof mode !== "string" ||
    !MODES.includes(mode as Mode) ||
    !isCount(score) ||
    !isCount(correct) ||
    !isCount(wrong)
  ) {
    return new Response(null, { status: 400 });
  }
  // difficulty — опційне поле нових клієнтів, лише для класики
  if (
    difficulty !== undefined &&
    (mode !== "classic" ||
      !DIFFICULTIES.includes(difficulty as Difficulty))
  ) {
    return new Response(null, { status: 400 });
  }
  const histKey =
    mode === "classic" && difficulty && difficulty !== "normal"
      ? `stats:v1:hist:classic:${difficulty}`
      : `stats:v1:hist:${mode}`;
  await Promise.all([
    // games.classic рахує всю класику разом, незалежно від рівня
    redis.hincrby("stats:v1:games", mode, 1),
    redis.hincrby(histKey, String(score), 1),
    redis.hincrby("stats:v1:moves", "correct", correct),
    redis.hincrby("stats:v1:moves", "wrong", wrong),
  ]);
  return Response.json({ ok: true });
}

/** Публічна агрегована статистика (кешується на CDN на хвилину). */
export async function GET() {
  if (!redis) return Response.json(null);
  const [games, classic, easy, hard, historian, category, daily, moves] =
    await Promise.all([
      redis.hgetall<Record<string, number>>("stats:v1:games"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:classic"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:classic:easy"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:classic:hard"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:classic:historian"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:category"),
      redis.hgetall<Record<string, number>>("stats:v1:hist:daily"),
      redis.hgetall<Record<string, number>>("stats:v1:moves"),
    ]);
  return Response.json(
    {
      games: games ?? {},
      hist: {
        classic: classic ?? {},
        "classic:easy": easy ?? {},
        "classic:hard": hard ?? {},
        "classic:historian": historian ?? {},
        category: category ?? {},
        daily: daily ?? {},
      },
      moves: moves ?? {},
    },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
