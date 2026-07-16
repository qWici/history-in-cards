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

const manifest = [];
const all = [];
const seen = new Set(); // qid|year — та сама подія з різних категорій лише раз

for (const file of readdirSync(ITEMS_DIR).sort()) {
  if (!file.endsWith(".json") || file.startsWith("_")) continue;
  const slug = file.replace(/\.json$/, "");
  const cards = JSON.parse(readFileSync(join(ITEMS_DIR, file), "utf8"));
  manifest.push({
    slug,
    name: names[slug] ?? slug,
    group: groupOf(slug),
    count: cards.length,
  });
  for (const card of cards) {
    const key = `${card.qid}|${card.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push({ ...card, category: slug });
  }
}

writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest));
writeFileSync(join(OUT_DIR, "all.json"), JSON.stringify(all));
console.log(
  `build-data: ${manifest.length} категорій, ${all.length} карток -> public/data/`,
);
