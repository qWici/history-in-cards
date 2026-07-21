import { buttonVariants } from "@heroui/react";
import Link from "next/link";
import { CardLibrary } from "@/components/CardLibrary";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const metadata = {
  title: "Картотека — Історія в картках",
  description:
    "Колекція всіх карток гри: події, персони та місця України з датами, фактами й посиланнями на Вікіпедію. Фільтри за категоріями та роками.",
};

export default function CardsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ⬅️ На головну
        </Link>
        <ThemeSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold">📚 Картотека</h1>
          <p className="mt-1 text-sm text-muted">
            Усі картки гри — гортай, фільтруй, читай
          </p>
        </div>
        <CardLibrary />
      </main>
    </div>
  );
}
