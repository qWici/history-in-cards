import type { Difficulty } from "./game";

const DIFFICULTY_KEY = "ua-trivia:difficulty";

export interface DifficultyOption {
  id: Difficulty;
  label: string;
  icon: string;
  hint: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  {
    id: "easy",
    label: "Легкий",
    icon: "🌱",
    hint: "Розминка: лише те, що знає кожен",
  },
  {
    id: "normal",
    label: "Звичайний",
    icon: "🎯",
    hint: "Від відомого — до несподіваного",
  },
  {
    id: "hard",
    label: "Важкий",
    icon: "🔥",
    hint: "Найвідоміші картки прибрано — буде складніше",
  },
  {
    id: "historian",
    label: "Історик",
    icon: "🎓",
    hint: "Глибини історії для справжніх знавців",
  },
];

export function difficultyMeta(id: Difficulty): DifficultyOption {
  return DIFFICULTIES.find((o) => o.id === id) ?? DIFFICULTIES[1];
}

/** Обраний рівень із localStorage (з фолбеком на «звичайний»). */
export function readDifficulty(): Difficulty {
  const raw = localStorage.getItem(DIFFICULTY_KEY);
  return DIFFICULTIES.some((o) => o.id === raw)
    ? (raw as Difficulty)
    : "normal";
}

export function saveDifficulty(id: Difficulty) {
  localStorage.setItem(DIFFICULTY_KEY, id);
}
