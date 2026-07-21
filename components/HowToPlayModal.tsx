"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

const STEPS = [
  {
    img: "/onboarding/step1.png",
    emoji: "🃏",
    title: "Отримай картку без року",
    text: "Подія, персона чи місце з історії України — а от коли це було, треба вгадати.",
  },
  {
    img: "/onboarding/step2.png",
    emoji: "👆",
    title: "Постав її на лінію часу",
    text: "Перетягни картку між іншими або просто натисни на місце, де їй бути.",
  },
  {
    img: "/onboarding/step3.png",
    emoji: "🇺🇦",
    title: "Бережи три прапорці",
    text: "Помилка забирає прапорець і показує правильний рік. Три промахи — гра завершена!",
  },
];

function StepImage({ img, emoji }: { img: string; emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-5xl">
        {emoji}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img}
      alt=""
      onError={() => setFailed(true)}
      className="h-24 w-24 shrink-0 rounded-2xl object-cover"
    />
  );
}

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Як грати"
      onClick={onClose}
    >
      <div
        className="card-slide-in w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-center text-2xl font-bold">Як грати</h2>
        <div className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex items-center gap-4">
              <StepImage img={step.img} emoji={step.emoji} />
              <div>
                <p className="font-semibold">
                  <span className="mr-1.5 text-muted">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="text-sm leading-relaxed text-muted">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="primary" fullWidth className="mt-6" onClick={onClose}>
          Зрозуміло, граймо!
        </Button>
      </div>
    </div>
  );
}
