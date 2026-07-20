import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

/** Скарга на картку: без деталей, просто лічильник по QID. */
export async function POST(req: Request) {
  if (!redis) return Response.json({ ok: false });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { qid, title } = body;
  if (
    typeof qid !== "string" ||
    !/^Q\d{1,12}$/.test(qid) ||
    typeof title !== "string" ||
    title.length > 200
  ) {
    return new Response(null, { status: 400 });
  }
  await Promise.all([
    redis.hincrby("reports:v1", qid, 1),
    redis.hsetnx("reports:v1:titles", qid, title),
  ]);
  return Response.json({ ok: true });
}

/** Прибрати виправлену картку зі скарг: DELETE /api/report?key=...&qid=Q123 */
export async function DELETE(req: Request) {
  const secret = process.env.REPORTS_SECRET;
  const params = new URL(req.url).searchParams;
  if (!redis || !secret || params.get("key") !== secret) {
    return new Response(null, { status: 404 });
  }
  const qid = params.get("qid");
  if (!qid || !/^Q\d{1,12}$/.test(qid)) {
    return new Response(null, { status: 400 });
  }
  await Promise.all([
    redis.hdel("reports:v1", qid),
    redis.hdel("reports:v1:titles", qid),
  ]);
  return Response.json({ ok: true });
}

/** Приватний перегляд скарг: GET /api/report?key=<REPORTS_SECRET>. */
export async function GET(req: Request) {
  const secret = process.env.REPORTS_SECRET;
  const key = new URL(req.url).searchParams.get("key");
  if (!redis || !secret || key !== secret) {
    return new Response(null, { status: 404 });
  }
  const [counts, titles] = await Promise.all([
    redis.hgetall<Record<string, number>>("reports:v1"),
    redis.hgetall<Record<string, string>>("reports:v1:titles"),
  ]);
  const rows = Object.entries(counts ?? {})
    .map(([qid, count]) => ({
      qid,
      count: Number(count),
      title: titles?.[qid] ?? "",
    }))
    .sort((a, b) => b.count - a.count);
  return Response.json(rows);
}
