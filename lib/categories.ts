/** Короткі підписи типу картки і кольори груп — як в оригінальному wikitrivia. */

export interface CategoryMeta {
  /** Підпис на картці: «Гетьман», «Фільм», «Місто»… */
  label: string;
  /** Акцентний колір групи (тінт фону картки). */
  color: string;
}

const GROUP_COLORS: [prefix: string, color: string][] = [
  ["ua-history", "#e5484d"], // Історія — червоний
  ["ua-leaders", "#f5a524"], // Правителі — бурштиновий
  ["ua-people", "#3b82f6"], // Люди — синій
  ["ua-art", "#a855f7"], // Мистецтво — фіолетовий
  ["ua-entertainment", "#a855f7"],
  ["ua-architecture", "#22c55e"], // Місця — зелений
  ["ua-places", "#22c55e"],
  ["ua-engineering", "#06b6d4"], // Наука і бізнес — бірюзовий
  ["ua-business", "#06b6d4"],
  ["ua-technology", "#06b6d4"],
  ["ua-sport", "#f97316"], // Спорт — помаранчевий
];

const LABELS: Record<string, string> = {
  "ua-history-battles": "Битва",
  "ua-history-wars": "Війна",
  "ua-history-revolts": "Повстання / революція",
  "ua-history-states": "Державне утворення",
  "ua-history-events": "Історична подія",
  "ua-history-tragedies": "Трагедія",
  "ua-history-documents": "Документ",
  "ua-leaders-rus-princes": "Князь Київської Русі",
  "ua-leaders-hetmans": "Гетьман",
  "ua-leaders-presidents": "Політик",
  "ua-leaders-1917-1921": "Діяч визвольних змагань",
  "ua-leaders-soviet": "Керівник УРСР",
  "ua-leaders-dissidents": "Дисидент",
  "ua-people-writers": "Письменник",
  "ua-people-scientists": "Науковець",
  "ua-people-military": "Військовий діяч",
  "ua-people-church": "Релігійний діяч",
  "ua-people-diaspora": "Народжені в Україні",
  "ua-people-famous-deaths": "Відома персона",
  "ua-art-artists": "Художник",
  "ua-art-paintings": "Картина",
  "ua-entertainment-books": "Літературний твір",
  "ua-entertainment-films": "Фільм",
  "ua-entertainment-music": "Музика",
  "ua-entertainment-songs": "Пісня",
  "ua-entertainment-theatre": "Театр",
  "ua-entertainment-tv": "Телеканал",
  "ua-entertainment-memes": "Мем",
  "ua-architecture-ancient-medieval": "Архітектура",
  "ua-architecture-early-modern": "Архітектура",
  "ua-architecture-modern": "Архітектура",
  "ua-places-cities": "Місто",
  "ua-places-universities": "Навчальний заклад",
  "ua-engineering-space-aviation": "Авіація та космос",
  "ua-engineering-military": "Військова техніка",
  "ua-engineering-discoveries": "Інженерія",
  "ua-business-companies": "Компанія",
  "ua-business-food-drink": "Їжа та напої",
  "ua-technology": "Технології",
  "ua-sport-athletes": "Спортсмен",
  "ua-sport-teams-stadiums": "Клуб / стадіон",
  "ua-sport-moments": "Спортивна подія",
};

/** Емодзі-іконки груп для сторінки категорій. */
export const GROUP_ICONS: Record<string, string> = {
  "Історія": "🏛️",
  "Правителі та політики": "👑",
  "Люди": "🌟",
  "Культура та мистецтво": "🎭",
  "Архітектура та місця": "🏰",
  "Наука і бізнес": "🚀",
  "Спорт": "⚽",
};

export function categoryMeta(slug: string): CategoryMeta {
  const color =
    GROUP_COLORS.find(([prefix]) => slug.startsWith(prefix))?.[1] ?? "#8b8b8b";
  return { label: LABELS[slug] ?? "", color };
}
