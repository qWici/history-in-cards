export interface GameCard {
  qid: string;
  title: string;
  subtitle: string | null;
  year: number;
  fact: string | null;
  wikipediaSlug: string;
  image: string | null;
  pageViews: number;
  category: string;
}

export interface CategoryInfo {
  slug: string;
  name: string;
  group: string;
  count: number;
  /** Обкладинка — зображення найвідомішої картки категорії. */
  image: string | null;
}

/** Картка, що вже лежить на таймлайні. */
export interface PlacedCard extends GameCard {
  /** Чи вгадав гравець позицію (стартова картка = true). */
  correct: boolean;
}
