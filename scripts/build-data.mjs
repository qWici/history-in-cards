// Готує ігрові дані з items-ua/ у public/data/:
//   all.json      — всі картки (дедуплікація однакових подій), поле category додано
//   manifest.json — перелік категорій з назвами, групами і кількістю карток
// Запускається автоматично перед dev/build (див. package.json).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ITEMS_DIR = join(ROOT, "items-ua");
const CONFIG = join(ROOT, "scripts", "ua_categories.json");
const OUT_DIR = resolve(__dirname, "../public/data");

const GROUPS = [
  { prefix: "ua-history", name: "Історія" },
  { prefix: "ua-leaders", name: "Правителі та політики" },
  { prefix: "ua-people", name: "Люди" },
  { prefix: "ua-art", name: "Культура та мистецтво" },
  { prefix: "ua-entertainment", name: "Культура та мистецтво" },
  { prefix: "ua-architecture", name: "Архітектура та місця" },
  { prefix: "ua-places", name: "Архітектура та місця" },
  { prefix: "ua-engineering", name: "Наука і бізнес" },
  { prefix: "ua-business", name: "Наука і бізнес" },
  { prefix: "ua-technology", name: "Наука і бізнес" },
  { prefix: "ua-sport", name: "Спорт" },
];

const groupOf = (slug) =>
  GROUPS.find((g) => slug.startsWith(g.prefix))?.name ?? "Інше";

const names = Object.fromEntries(
  JSON.parse(readFileSync(CONFIG, "utf8")).categories.map((c) => [c.slug, c.name]),
);

mkdirSync(OUT_DIR, { recursive: true });

// Та сама подія (qid + рік) може бути згенерована в кількох категоріях
// (Шевченко «народився» — і письменник, і художник). Власника визначає
// пріоритет: перша категорія зі списку забирає картку собі, решта її
// не отримують — ні в колоду категорії, ні в лічильник, ні в обкладинку.
const OWNER_PRIORITY = [
  "ua-leaders-hetmans",
  "ua-leaders-rus-princes",
  "ua-leaders-presidents",
  "ua-leaders-1917-1921",
  "ua-leaders-dissidents",
  "ua-leaders-soviet",
  "ua-people-church",
  "ua-people-writers",
  "ua-art-artists",
  "ua-people-scientists",
  "ua-entertainment-music",
  "ua-people-military",
  "ua-sport-athletes",
  "ua-people-diaspora",
  "ua-people-famous-deaths",
];

const filesBySlug = new Map();
for (const file of readdirSync(ITEMS_DIR).sort()) {
  if (!file.endsWith(".json") || file.startsWith("_")) continue;
  const slug = file.replace(/\.json$/, "");
  filesBySlug.set(slug, JSON.parse(readFileSync(join(ITEMS_DIR, file), "utf8")));
}

const slugsInOwnerOrder = [
  ...OWNER_PRIORITY.filter((s) => filesBySlug.has(s)),
  ...[...filesBySlug.keys()].filter((s) => !OWNER_PRIORITY.includes(s)),
];

const seen = new Set(); // qid|year
const ownedBySlug = new Map();
for (const slug of slugsInOwnerOrder) {
  const owned = [];
  for (const card of filesBySlug.get(slug)) {
    const key = `${card.qid}|${card.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    owned.push({ ...card, category: slug });
  }
  ownedBySlug.set(slug, owned);
}

// Ручні обкладинки категорій: slug -> qid картки (коли автовибір невдалий)
const COVER_OVERRIDES = {
  "ua-entertainment-tv": "Q2638833", // Новий канал: квадратний логотип
};

const manifest = [];
const all = [];
const seenCovers = new Set(); // одна персона — обкладинка лише однієї плитки
for (const slug of [...filesBySlug.keys()]) {
  const owned = ownedBySlug.get(slug) ?? [];
  const cover =
    owned.find((c) => c.qid === COVER_OVERRIDES[slug] && c.image) ??
    [...owned]
      .sort((a, b) => b.pageViews - a.pageViews)
      .find((c) => c.image && !seenCovers.has(c.qid));
  if (cover) seenCovers.add(cover.qid);
  manifest.push({
    slug,
    name: names[slug] ?? slug,
    group: groupOf(slug),
    count: owned.length,
    image: cover?.image ?? null,
  });
  all.push(...owned);
}

writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest));
writeFileSync(join(OUT_DIR, "all.json"), JSON.stringify(all));
console.log(
  `build-data: ${manifest.length} категорій, ${all.length} карток -> public/data/`,
);
