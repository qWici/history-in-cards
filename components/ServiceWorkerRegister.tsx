"use client";

import { useEffect } from "react";

/** Реєструє service worker (офлайн + встановлення PWA). Лише у проді —
 *  у dev він кешував би HMR-чанки і зводив розробку з розуму. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
