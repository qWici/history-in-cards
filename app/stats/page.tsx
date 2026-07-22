import { buttonVariants } from "@heroui/react";
import Link from "next/link";
import { StatsView } from "@/components/StatsView";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const metadata = {
  title: "Статистика — Історія в картках",
  description:
    "Публічна статистика гри: скільки партій зіграно, розподіл рахунків, найбільший рекорд.",
};

export default function StatsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ⬅️ На головну
        </Link>
        <ThemeSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-10">
        <h1 className="text-center text-3xl font-bold">📊 Статистика гри</h1>
        <StatsView />
      </main>
    </div>
  );
}
