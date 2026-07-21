# Історія в картках 🇺🇦

Українська хронологічна гра-вікторина (натхнення — [wikitrivia](https://wikitrivia.tomjwatson.com)):
гравець отримує картку події, персони чи місця України **без року** і має поставити її
в правильне місце на лінії часу. Три промахи — кінець гри.

Дані — з Wikidata та української Вікіпедії, ~1000 карток у 41 категорії.

## Режими

| Режим | URL | Опис |
|---|---|---|
| Класичний | `/play` | Всі категорії впереміш, 3 життя, рахунок = серія правильних |
| За категорією | `/categories` → `/play?deck=<slug>` або `/play?group=<група>` | Колода тільки з обраної теми |
| Щоденний виклик | `/daily` | 12 карток, однакові для всіх гравців дня (seed від дати за Києвом), одна спроба, шер результату емодзі |

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · HeroUI v3 · Tailwind CSS v4 ·
dnd-kit (drag & drop) · zustand · next-themes (дефолт — dark) · Vercel Analytics.

## Запуск

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # продакшн-збірка
```

Перед `dev`/`build` автоматично запускається `scripts/build-data.mjs`, який збирає
`items-ua/*.json` у `public/data/all.json` (дедуплікація однакових подій) та
`public/data/manifest.json` (перелік категорій). `public/data/` — у `.gitignore`.

## Як влаштовані дані

Кожна картка (`items-ua/<категорія>.json`):

```json
{
  "qid": "Q165419",              // сутність Wikidata
  "title": "Іван Мазепа — стає гетьманом",
  "subtitle": "український військовий, політичний і державний діяч…",
  "year": 1687,                  // може бути від'ємним (до н. е.)
  "fact": "Іван Степанович Мазепа — …",   // короткий опис з uk-wiki
  "wikipediaSlug": "Іван_Мазепа",          // стаття uk.wikipedia.org
  "image": "Portret_Mazepa.jpg",           // файл на Wikimedia Commons (може бути null)
  "pageViews": 93945             // перегляди статті в uk-wiki (міра відомості)
}
```

Зображення беруться напряму з CDN Вікімедії:
`https://commons.wikimedia.org/wiki/Special:FilePath/<image>?width=480`.

## Як оновити картки

```bash
python3 scripts/generate_ua_items.py                      # всі категорії (~30 хв)
python3 scripts/generate_ua_items.py --only ua-leaders-hetmans,ua-places-cities
python3 scripts/generate_ua_items.py --list               # перелік категорій
npm run build-data                                        # оновити дані сайту
```

Потрібен лише Python 3.9+ (стандартна бібліотека). Пайплайн для кожної категорії:

1. **Кандидати** — SPARQL-запит до Wikidata (класи + зв'язок з Україною) або ручний
   seed-список назв статей uk-wiki.
2. **Фільтр відомості** — кількість sitelinks (мовних версій статті) + перегляди
   статті в **українській** Вікіпедії (за весь доступний період, API має дані з
   липня 2015; поріг `min_pageviews` означає *переглядів на рік*).
3. **Придатність** — є дата, є зображення (для держав — fallback на прапор/герб),
   є стаття в uk-wiki.
4. З назв автоматично вирізаються роки-підказки («(з 2014)», «Хотинська битва 1621»).

Побічний продукт — `items-ua/_report.json`: усі відкинуті кандидати з причинами
(нема фото / нема дати / мало переглядів) — корисно для курації.

## Конфіг категорій — `scripts/ua_categories.json`

Правиться без коду. Типи категорій:

- `event` — об'єкти за класами Wikidata (битви, будівлі, фільми…);
- `person` — люди за професіями + громадянство/місце народження Україна;
- `position` — люди за посадою (гетьман, президент) з датою вступу;
- `seed` — ручний список назв статей uk-wiki (скрипт сам знаходить QID, дату, фото).

Корисні поля:

| Поле | Що робить |
|---|---|
| `exclude: ["Q835"]` | **Вічний бан картки** — переживає всі перезапуски (так прибрано російських діячів) |
| `name_overrides` (глобальне) | Перейменування за QID («„Динамо" уперше здобуває Кубок кубків») |
| `min_sitelinks`, `min_pageviews`, `max_cards` | Пороги відомості та розмір категорії |
| `year_from_ukwiki_infobox: true` | Рік з поля «засноване» інфобоксу uk-wiki замість Wikidata (міста: Одеса = 1794, а не 1500) |
| `require_image: false` | Дозволити картки без фото (документи, пісні) |
| `titles` (для seed) | Додай назву статті uk-wiki і перезапусти — картка з'явиться. Елемент може бути об'єктом `{"title": "...", "year": 2021}` — явний рік для сутностей без дат у Wikidata (меми тощо) |

**Прибрати погану картку назавжди**: знайди її `qid` у JSON → додай у `exclude`
відповідної категорії → перезапусти категорію.

**Додати нову категорію**: новий об'єкт у `categories` + підпис і колір групи
в `lib/categories.ts` (мапи `LABELS` / `GROUP_COLORS`).

## Структура

```
app/            сторінки (/, /play, /categories, /daily)
components/     GameBoard (драг, фліп, колода), GameCard, CardModal, DailyResult…
lib/            game.ts (движок, seeded daily), store.ts (zustand), categories.ts
items-ua/       згенеровані картки — джерело даних (комітиться)
scripts/        generate_ua_items.py + ua_categories.json + build-data.mjs
public/data/    згенеровано build-data (у .gitignore)
```

## Мультиплеєр (partyserver на Cloudflare)

Кімнати — Durable Objects через [partyserver](https://github.com/cloudflare/partykit)
(наступник PartyKit від Cloudflare): авторитарний сервер у `party/room.ts`,
воркер-роутер — `party/worker.ts`, спільні типи — `lib/multiplayer.ts`,
конфіг — `wrangler.jsonc`. Клієнт — `partysocket` (шлях `/parties/main/<код>`).

Локально: `npm run party:dev` (порт 1999, змінні з `.dev.vars`) +
`NEXT_PUBLIC_PARTYKIT_HOST="127.0.0.1:1999"` в `.env.local`.

Деплой у свій Cloudflare-акаунт (разово: `npx wrangler login`):

```bash
npm run party:deploy:dev    # history-in-cards-dev.<акаунт>.workers.dev
npm run party:deploy:prod   # history-in-cards.<акаунт>.workers.dev
```

Дев і прод — окремі воркери (env "production" у `wrangler.jsonc`), кожен зі
своїм `SITE_URL` (звідти сервер тягне `/data/all.json`). На Vercel постав
`NEXT_PUBLIC_PARTYKIT_HOST` (хостнейм воркера без протоколу): Production —
прод-воркер, Preview/дев-гілка — дев-воркер. Це build-time змінна — після
зміни потрібен редеплой сайту.

## Публічна статистика (`/stats`)

Кожна завершена партія шле результат у `POST /api/stats` (режим, рахунок,
правильні/неправильні ходи) → лічильники в Upstash Redis. `GET /api/stats` —
публічна агрегація (кеш CDN 60с), сторінка `/stats` малює гістограми.

Налаштування: Vercel → Marketplace → **Upstash Redis** (безкоштовний тариф) →
Connect до проєкту. Env-змінні (`UPSTASH_REDIS_REST_URL/TOKEN` або легасі
`KV_REST_API_URL/TOKEN`) підтягнуться самі; локально — `vercel env pull`.
Без ключів усе працює як no-op: гра не ламається, сторінка пише
«статистика тимчасово недоступна».

## Скарги на картки

У модалці кожної картки є кнопка-прапорець «Повідомити про помилку» — без
жодних полів: `POST /api/report` інкрементить лічильник по QID у Redis
(`reports:v1`), повторні скарги з одного браузера блокуються localStorage.

Робота зі скаргами (потрібен env `REPORTS_SECRET` — будь-який довгий рядок;
без нього ендпоінти віддають 404). Альтернатива без API — **Upstash Data
Browser**, хеші `reports:v1` та `reports:v1:titles`.

```bash
# переглянути всі скарги (JSON, відсортовано за кількістю)
curl 'https://<домен>/api/report?key=<REPORTS_SECRET>'

# картку виправлено — прибрати її зі списку скарг
curl -X DELETE 'https://<домен>/api/report?key=<REPORTS_SECRET>&qid=Q165419'
```

Виправлення самої картки — див. «Конфіг категорій» вище
(`exclude` / `name_overrides` / `year_overrides`), після чого перегенеруй
категорію і не забудь `npm run build-data`.

## Ліцензії даних

Тексти фактів — CC BY-SA (Вікіпедія), зображення — Wikimedia Commons (ліцензія
кожного файлу на його сторінці), структуровані дані — Wikidata (CC0).
