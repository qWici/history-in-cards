/* Service worker «Історії в картках»: офлайн-гра.
 *
 * Стратегії:
 * - /_next/static/ (хешовані чанки)     — cache-first, вічні
 * - /data/ (картки)                      — кеш одразу, оновлення у фоні
 * - зображення Вікімедії                 — cache-first з лімітом (~300)
 * - навігація (HTML)                     — network-first, офлайн — з кешу
 * - /api/ і сторонні хости               — не чіпаємо (лише мережа)
 *
 * Кеш наповнюється в міру гри: зіграв онлайн — можеш переграти офлайн.
 * VERSION бампається лише при зміні логіки цього файлу.
 */
const VERSION = "v1";
const CACHE = `ua-trivia-${VERSION}`;
const IMG_CACHE = `ua-trivia-img-${VERSION}`;
const IMG_LIMIT = 300;

const PRECACHE = ["/", "/play", "/data/all.json", "/data/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}) // офлайн-встановлення не має валити SW
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("ua-trivia-") && k !== CACHE && k !== IMG_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function putSafe(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    /* сховище переповнене — граємо без кешу */
  }
}

async function trimImages() {
  const cache = await caches.open(IMG_CACHE);
  const keys = await cache.keys();
  if (keys.length > IMG_LIMIT) {
    await Promise.all(
      keys.slice(0, keys.length - IMG_LIMIT).map((k) => cache.delete(k)),
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // зображення карток з Вікімедії: cache-first + ліміт розміру кешу
  if (
    url.hostname === "commons.wikimedia.org" ||
    url.hostname === "upload.wikimedia.org"
  ) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok || res.type === "opaque") {
          putSafe(IMG_CACHE, request, res.clone());
          event.waitUntil(trimImages());
        }
        return res;
      })(),
    );
    return;
  }

  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // статистика/скарги — лише мережа

  // хешовані асети: вміст незмінний, кеш назавжди
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) putSafe(CACHE, request, res.clone());
            return res;
          }),
      ),
    );
    return;
  }

  // дані гри: віддаємо кеш миттєво, свіже тягнемо у фоні на наступний раз
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) putSafe(CACHE, request, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) ?? Response.error();
      })(),
    );
    return;
  }

  // сторінки: мережа перш за все, офлайн — остання збережена версія
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) putSafe(CACHE, request, res.clone());
          return res;
        } catch {
          return (
            (await caches.match(request)) ??
            (await caches.match("/")) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // решта свого домену (шрифти, іконки): cache-first у міру використання
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok) putSafe(CACHE, request, res.clone());
          return res;
        }),
    ),
  );
});
