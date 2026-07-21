import { buttonVariants } from "@heroui/react";
import Link from "next/link";
import { BestScore } from "@/components/BestScore";
import { FlagUA } from "@/components/FlagUA";
import { GithubBlock } from "@/components/GithubBlock";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end px-4 py-3">
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 pb-32 text-center">
        <div className="space-y-3">
          <div className="flex justify-center" aria-hidden>
            <FlagUA width={72} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Історія в картках
          </h1>
          <p className="mx-auto max-w-md text-balance text-muted">
            Постав події, людей і місця України в правильному хронологічному
            порядку
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* одна домінанта на сторінці — велика CTA */}
          <Link
            href="/play"
            className={`${buttonVariants({ variant: "primary", size: "lg" })} h-16 px-16 text-2xl font-bold`}
          >
            <svg
              className="-ml-4 mr-1"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              aria-hidden
            >
              <polygon points="7 4.5 19.5 12 7 19.5" />
            </svg>
            Грати
          </Link>
          <BestScore />
          {/* другорядні дії — навмисно легші за CTA */}
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            <Link
              href="/categories"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              🗂 Категорії
            </Link>
            <Link
              href="/daily"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              📅 Щоденний виклик
            </Link>
            <Link
              href="/stats"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              📊 Статистика
            </Link>
            <Link
              href="/cards"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              📚 Картотека
            </Link>
          </div>
        </div>

      </main>
      <footer className="flex flex-col items-center gap-4 px-6 pb-8">
        <div className="space-y-1 text-center text-xs text-muted">
          <p>
            Дані:{" "}
            <a
              className="underline underline-offset-2"
              href="https://www.wikidata.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikidata
            </a>{" "}
            та{" "}
            <a
              className="underline underline-offset-2"
              href="https://uk.wikipedia.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              українська Вікіпедія
            </a>{" "}
            (CC BY-SA)
          </p>
          <p>Зображення — Wikimedia Commons</p>
          <p>
            Натхнення —{" "}
            <a
              className="underline underline-offset-2"
              href="https://wikitrivia.tomjwatson.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              wikitrivia
            </a>
            .
          </p>
        </div>
        <GithubBlock />
      </footer>
    </div>
  );
}
