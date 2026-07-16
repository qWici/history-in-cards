import type { GameCard } from "./types";

/** «528 до н. е.» для від'ємних років. */
export function formatYear(year: number): string {
  return year < 0 ? `${-year} до н. е.` : String(year);
}

/**
 * Чи валідна вставка картки у слот `index` (перед timeline[index]).
 * Однакові роки: будь-яка позиція серед рівних вважається правильною.
 */
export function isValidPlacement(
  timeline: { year: number }[],
  index: number,
  year: number,
): boolean {
  const left = index > 0 ? timeline[index - 1].year : -Infinity;
  const right = index < timeline.length ? timeline[index].year : Infinity;
  return left <= year && year <= right;
}

/** Індекс, куди картка стає правильно (перша валідна позиція). */
export function correctIndex(timeline: { year: number }[], year: number): number {
  let i = 0;
  while (i < timeline.length && timeline[i].year < year) i++;
  return i;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Колода з кривою складності: гра починається з найвідоміших карток,
 * далі поступово підмішуються рідші. Пул ділиться на 5 кошиків за
 * pageViews; кошик для i-ї картки — min(floor(i / PER_LEVEL), 4),
 * з фолбеком на сусідні, коли кошик спорожнів.
 * Дублікатні qid (та сама персона з різними подіями) в партію не потрапляють.
 * `seen` — нещодавно бачені картки: відсуваються в хвіст свого кошика,
 * щоб між партіями спершу приходило свіже.
 */
export function buildDeck(
  pool: GameCard[],
  size = 200,
  seen?: Set<string>,
): GameCard[] {
  const PER_LEVEL = 8;
  const byQid = new Map<string, GameCard[]>();
  for (const c of pool) {
    (byQid.get(c.qid) ?? byQid.set(c.qid, []).get(c.qid)!).push(c);
  }
  // одна випадкова подія на сутність
  const unique = [...byQid.values()].map(
    (variants) => variants[Math.floor(Math.random() * variants.length)],
  );
  const sorted = [...unique].sort((a, b) => b.pageViews - a.pageViews);
  const bucketSize = Math.ceil(sorted.length / 5);
  const buckets: GameCard[][] = Array.from({ length: 5 }, (_, i) =>
    shuffle(sorted.slice(i * bucketSize, (i + 1) * bucketSize)),
  );
  if (seen?.size) {
    // тягнемо з кінця (pop) — бачені кладемо на початок, щоб діставались останніми
    for (const bucket of buckets) {
      bucket.sort(
        (a, b) => (seen.has(a.qid) ? 0 : 1) - (seen.has(b.qid) ? 0 : 1),
      );
    }
  }

  const deck: GameCard[] = [];
  for (let i = 0; deck.length < size; i++) {
    const want = Math.min(Math.floor(i / PER_LEVEL), 4);
    // найближчий непорожній кошик до бажаного
    const order = [want, want + 1, want - 1, want + 2, want - 2, want + 3, want + 4]
      .filter((b) => b >= 0 && b < 5);
    const bucket = order.map((b) => buckets[b]).find((b) => b.length > 0);
    if (!bucket) break;
    deck.push(bucket.pop()!);
  }
  return deck;
}

// ---------------------------------------------------------------- щоденний

/** Детермінований hash рядка -> число (для seed PRNG). */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — маленький якісний seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Сьогоднішня дата в Києві, YYYY-MM-DD (доба виклику живе за Києвом). */
export function kyivToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(
    new Date(),
  );
}

/** Попередній день для дати YYYY-MM-DD. */
export function prevDay(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Колода щоденного виклику: однакова для всіх гравців дня.
 * Пул — топ-500 найвідоміших карток (дедуп за qid), із них seeded PRNG
 * від дати обирає 13: перша — стартова на таймлайні, 12 — розкласти.
 */
export function buildDailyDeck(pool: GameCard[], date: string): GameCard[] {
  const byQid = new Map<string, GameCard>();
  for (const c of [...pool].sort((a, b) => b.pageViews - a.pageViews)) {
    if (!byQid.has(c.qid)) byQid.set(c.qid, c);
  }
  const top = [...byQid.values()].slice(0, 500);
  return seededShuffle(top, mulberry32(hashSeed("ua-trivia-" + date))).slice(0, 13);
}

/** URL зображення з Wikimedia Commons за ім'ям файлу. */
export function imageUrl(image: string, width = 480): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}?width=${width}`;
}

export function wikiUrl(slug: string): string {
  return `https://uk.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
}
