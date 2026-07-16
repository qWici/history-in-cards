"use client";

import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  // До маунта тема невідома: server і перший client-рендер мусять збігатися,
  // тому і label, і іконка залежать від mounted (дефолт — dark/сонце).
  return (
    <Button
      variant="ghost"
      isIconOnly
      aria-label={
        mounted
          ? isDark
            ? "Увімкнути світлу тему"
            : "Увімкнути темну тему"
          : "Перемкнути тему"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && !isDark ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
