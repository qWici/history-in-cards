import { GameBoard } from "@/components/GameBoard";
import manifest from "@/public/data/manifest.json";
import type { CategoryInfo } from "@/lib/types";

export const metadata = {
  title: "Гра — Історія в картках",
};

interface Props {
  searchParams: Promise<{ deck?: string; group?: string }>;
}

export default async function PlayPage({ searchParams }: Props) {
  const { deck, group } = await searchParams;
  const categories = manifest as CategoryInfo[];

  if (deck) {
    const cat = categories.find((c) => c.slug === deck);
    if (cat) {
      return <GameBoard slugs={[cat.slug]} categoryName={cat.name} />;
    }
  }
  if (group) {
    const slugs = categories.filter((c) => c.group === group).map((c) => c.slug);
    if (slugs.length) {
      return <GameBoard slugs={slugs} categoryName={group} />;
    }
  }
  return <GameBoard />;
}
