import { buttonVariants } from "@heroui/react";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { categoryMeta, GROUP_ICONS } from "@/lib/categories";
import { imageUrl } from "@/lib/game";
import type { CategoryInfo } from "@/lib/types";
import manifest from "@/public/data/manifest.json";

export const metadata = {
  title: "Категорії — Історія в картках",
};

const MIN_CARDS = 15; // менші категорії граються лише в складі групи

function CategoryTile({ cat }: { cat: CategoryInfo }) {
  const { color } = categoryMeta(cat.slug);
  const playable = cat.count >= MIN_CARDS;
  const body = (
    <>
      <div
        className="h-48 w-full overflow-hidden"
        style={{
          background: `color-mix(in oklab, var(--color-background-tertiary) 70%, ${color} 30%)`,
        }}
      >
        {cat.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(cat.image)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {cat.name}
        </p>
        <p className="mt-auto text-xs text-muted">
          {cat.count} карток{playable ? "" : " · лише в групі"}
        </p>
      </div>
    </>
  );
  const className =
    "flex flex-col overflow-hidden rounded-xl border-2 transition-transform";
  const style = {
    background: `color-mix(in oklab, var(--color-background-secondary) 82%, ${color} 18%)`,
    borderColor: `color-mix(in oklab, var(--color-border) 55%, ${color} 45%)`,
  };
  if (!playable) {
    return (
      <div
        className={`${className} opacity-55`}
        style={style}
        title="Замало карток для окремої гри — грається в складі групи"
      >
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/play?deck=${cat.slug}`}
      className={`${className} hover:-translate-y-1 hover:shadow-lg`}
      style={style}
    >
      {body}
    </Link>
  );
}

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
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-10">
        <h1 className="text-center text-3xl font-bold">Оберіть тему</h1>
        {[...groups.entries()].map(([group, cats]) => {
          const total = cats.reduce((s, c) => s + c.count, 0);
          const { color } = categoryMeta(cats[0].slug);
          return (
            <section
              key={group}
              className="rounded-2xl border-2 p-4 sm:p-5"
              style={{
                background: `color-mix(in oklab, var(--color-background-secondary) 90%, ${color} 10%)`,
                borderColor: `color-mix(in oklab, var(--color-border) 60%, ${color} 40%)`,
              }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <span className="text-2xl" aria-hidden>
                    {GROUP_ICONS[group] ?? "🃏"}
                  </span>
                  {group}
                </h2>
                <Link
                  href={`/play?group=${encodeURIComponent(group)}`}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  Грати всю групу · {total}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {cats.map((cat) => (
                  <CategoryTile key={cat.slug} cat={cat} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
