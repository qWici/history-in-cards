import { buttonVariants, Card } from "@heroui/react";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import manifest from "@/public/data/manifest.json";
import type { CategoryInfo } from "@/lib/types";

export const metadata = {
  title: "Категорії — Історія в картках",
};

const MIN_CARDS = 15; // менші категорії граються лише в складі групи

export default function CategoriesPage() {
  const categories = manifest as CategoryInfo[];
  const groups = new Map<string, CategoryInfo[]>();
  for (const cat of categories) {
    (groups.get(cat.group) ?? groups.set(cat.group, []).get(cat.group)!).push(cat);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ⬅️ На головну
        </Link>
        <ThemeSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-10">
        <h1 className="text-center text-3xl font-bold">Оберіть тему</h1>
        {[...groups.entries()].map(([group, cats]) => {
          const total = cats.reduce((s, c) => s + c.count, 0);
          return (
            <Card key={group}>
              <Card.Header>
                <div className="flex w-full items-center justify-between gap-3">
                  <Card.Title>{group}</Card.Title>
                  <Link
                    href={`/play?group=${encodeURIComponent(group)}`}
                    className={buttonVariants({ variant: "primary", size: "sm" })}
                  >
                    Грати всю групу · {total}
                  </Link>
                </div>
              </Card.Header>
              <Card.Content>
                <div className="flex flex-wrap gap-2">
                  {cats.map((cat) =>
                    cat.count >= MIN_CARDS ? (
                      <Link
                        key={cat.slug}
                        href={`/play?deck=${cat.slug}`}
                        className={buttonVariants({
                          variant: "secondary",
                          size: "sm",
                        })}
                      >
                        {cat.name} · {cat.count}
                      </Link>
                    ) : (
                      <span
                        key={cat.slug}
                        title="Замало карток для окремої гри — грається в складі групи"
                        className={`${buttonVariants({ variant: "ghost", size: "sm" })} cursor-not-allowed opacity-50`}
                      >
                        {cat.name} · {cat.count}
                      </span>
                    ),
                  )}
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
