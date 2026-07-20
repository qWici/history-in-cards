import { Redis } from "@upstash/redis";

// Підтримуємо обидві схеми назв env: Upstash Marketplace і легасі Vercel KV
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const MODES = ["classic", "category", "daily"] as const;
type Mode = (typeof MODES)[number];

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
  const { mode, score, correct, wrong } = body;
  if (
    typeof mode !== "string" ||
    !MODES.includes(mode as Mode) ||
    !isCount(score) ||
    !isCount(correct) ||
    !isCount(wrong)
  ) {
    return new Response(null, { status: 400 });
  }
  await Promise.all([
    redis.hincrby("stats:v1:games", mode, 1),
    redis.hincrby(`stats:v1:hist:${mode}`, String(score), 1),
    redis.hincrby("stats:v1:moves", "correct", correct),
    redis.hincrby("stats:v1:moves", "wrong", wrong),
  ]);
  return Response.json({ ok: true });
}

/** Публічна агрегована статистика (кешується на CDN на хвилину). */
export async function GET() {
  if (!redis) return Response.json(null);
  const [games, classic, category, daily, moves] = await Promise.all([
    redis.hgetall<Record<string, number>>("stats:v1:games"),
    redis.hgetall<Record<string, number>>("stats:v1:hist:classic"),
    redis.hgetall<Record<string, number>>("stats:v1:hist:category"),
    redis.hgetall<Record<string, number>>("stats:v1:hist:daily"),
    redis.hgetall<Record<string, number>>("stats:v1:moves"),
  ]);
  return Response.json(
    {
      games: games ?? {},
      hist: { classic: classic ?? {}, category: category ?? {}, daily: daily ?? {} },
      moves: moves ?? {},
    },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
