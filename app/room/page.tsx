"use client";

import { Button, buttonVariants } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

/** Код без символів, які плутаються: O/0, I/1/L. */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => alphabet[b % alphabet.length],
  ).join("");
}

export default function RoomLandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ⬅️ На головну
        </Link>
        <ThemeSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
        <h1 className="text-center text-3xl font-bold">👥 Мультиплеєр</h1>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push(`/room/${generateCode()}`)}
        >
          Створити кімнату
        </Button>
        <div className="flex w-full items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          або приєднайся за кодом
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex w-full gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) =>
              e.key === "Enter" && joinCode.length === 6 && router.push(`/room/${joinCode}`)
            }
            placeholder="КОД123"
            className="h-11 flex-1 rounded-lg border border-border bg-background-secondary px-3 text-center text-lg font-bold tracking-[0.3em] uppercase outline-none focus:border-accent"
          />
          <Button
            variant="secondary"
            isDisabled={joinCode.length !== 6}
            onClick={() => router.push(`/room/${joinCode}`)}
          >
            Увійти
          </Button>
        </div>
      </main>
    </div>
  );
}
