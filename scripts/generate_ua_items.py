#!/usr/bin/env python3
"""Генератор карточок для української версії wikitrivia.

Для кожної категорії з scripts/ua_categories.json:
  1. Отримує кандидатів з Wikidata (SPARQL) або з seed-списку назв статей uk-wiki.
  2. Фільтрує за кількістю sitelinks (перший фільтр відомості).
  3. Тягне з Wikidata: посилання на uk-wiki, опис, зображення (P18), стать (P21).
  4. Рахує перегляди статті в uk-wiki за останні 12 місяців (другий фільтр).
  5. Бере короткий факт з uk-wiki (REST summary).
  6. Пише items-ua/<slug>.json у форматі оригінального wikitrivia
     (qid, title, subtitle, year, fact, wikipediaSlug, image, pageViews)
     та зведений звіт items-ua/_report.json.

Використання:
  python3 scripts/generate_ua_items.py              # всі категорії
  python3 scripts/generate_ua_items.py --only ua-history-battles,ua-leaders-hetmans
  python3 scripts/generate_ua_items.py --list       # перелік категорій

Залежності: тільки стандартна бібліотека Python 3.9+.
"""

import argparse
import datetime
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "ua-wikitrivia-generator/1.0 (ivan.kucher@uni.tech)"
WDQS_URL = "https://query.wikidata.org/sparql"
WD_API = "https://www.wikidata.org/w/api.php"
UKWIKI_API = "https://uk.wikipedia.org/w/api.php"
PAGEVIEWS_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
    "uk.wikipedia/all-access/user/{title}/monthly/{start}/{end}"
)
SUMMARY_URL = "https://uk.wikipedia.org/api/rest_v1/page/summary/{title}"

MALE = "http://www.wikidata.org/entity/Q6581097"
FEMALE = "http://www.wikidata.org/entity/Q6581072"

_pageviews_cache = {}
_summary_cache = {}


# --------------------------------------------------------------------------- http

def http_get(url, params=None, accept="application/json", retries=4):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": accept,
        })
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last_err = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(3 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"HTTP failed after {retries} tries: {url} ({last_err})")


def sparql(query):
    time.sleep(1.5)  # ввічливість до WDQS
    data = http_get(WDQS_URL, {"query": query, "format": "json"},
                    accept="application/sparql-results+json")
    return data["results"]["bindings"]


# --------------------------------------------------------------------- query build

def _country_block(country):
    """country: {"props": ["P17"], "values": ["Q212"]} -> triple або UNION."""
    if not country:
        return ""
    parts = []
    for prop in country["props"]:
        for val in country["values"]:
            parts.append("{ ?item wdt:%s wd:%s . }" % (prop, val))
    if len(parts) == 1:
        return "  ?item wdt:%s wd:%s .\n" % (country["props"][0], country["values"][0])
    return "  " + " UNION ".join(parts) + "\n"


def _date_block(date_props):
    if len(date_props) == 1:
        return "  ?item wdt:%s ?date .\n" % date_props[0]
    lines, names = [], []
    for i, p in enumerate(date_props):
        lines.append("  OPTIONAL { ?item wdt:%s ?d%d . }" % (p, i))
        names.append("?d%d" % i)
    lines.append("  BIND(COALESCE(%s) AS ?date)" % ", ".join(names))
    lines.append("  FILTER(BOUND(?date))")
    return "\n".join(lines) + "\n"


def build_query(part, defaults):
    min_links = part.get("min_sitelinks", defaults["min_sitelinks"])
    limit = part.get("limit_candidates", defaults["limit_candidates"])
    extra = "".join("  %s\n" % line for line in part.get("extra", []))
    tail = (
        "  ?item wikibase:sitelinks ?links .\n"
        "  FILTER(?links >= %d)\n"
        '  SERVICE wikibase:label { bd:serviceParam wikibase:language "uk,en". }\n'
        "}\nORDER BY DESC(?links)\nLIMIT %d" % (min_links, limit)
    )
    t = part["type"]
    if t == "event":
        values = " ".join("wd:%s" % c for c in part["classes"])
        return (
            "SELECT DISTINCT ?item ?itemLabel ?date ?links WHERE {\n"
            "  VALUES ?cls { %s }\n"
            "  ?item wdt:P31/wdt:P279* ?cls .\n" % values
            + _country_block(part.get("country"))
            + extra
            + _date_block(part["date_props"])
            + tail
        )
    if t == "person":
        occ = ""
        if part.get("occupations"):
            # Прямий P106 за замовчуванням: підкласи (P279*) тягнуть сміття
            # (етнограф -> науковець тощо). Для атлетів підкласи потрібні.
            path = "wdt:P106/wdt:P279*" if part.get("occupations_subclass") else "wdt:P106"
            occ = ("  VALUES ?occ { %s }\n  ?item %s ?occ .\n"
                   % (" ".join("wd:%s" % o for o in part["occupations"]), path))
        mode = part.get("ua_mode", "any")
        if mode == "born_not_citizen":
            ua = ("  ?item wdt:P19 ?bp . ?bp wdt:P17 wd:Q212 .\n"
                  "  FILTER NOT EXISTS { ?item wdt:P27 wd:Q212 . }\n")
        else:
            ua = ("  { ?item wdt:P27 wd:Q212 . } UNION "
                  "{ ?item wdt:P19 ?bp . ?bp wdt:P17 wd:Q212 . }\n")
        date_prop = part.get("date_prop", "P569")
        return (
            "SELECT DISTINCT ?item ?itemLabel ?date ?links ?gender WHERE {\n"
            "  ?item wdt:P31 wd:Q5 .\n"
            + occ + ua + extra
            + "  ?item wdt:%s ?date .\n" % date_prop
            + "  OPTIONAL { ?item wdt:P21 ?gender . }\n"
            + tail
        )
    if t == "position":
        return (
            "SELECT DISTINCT ?item ?itemLabel ?date ?links ?gender WHERE {\n"
            "  ?item p:P39 ?st .\n"
            "  ?st ps:P39 wd:%s ; pq:P580 ?date .\n" % part["position"]
            + extra
            + "  OPTIONAL { ?item wdt:P21 ?gender . }\n"
            + tail
        )
    raise ValueError("unknown part type: " + t)


# ------------------------------------------------------------------------- seeds

def resolve_seeds(titles, log):
    """uk-wiki назви -> QID (з follow redirects; fallback — пошук).

    Повертає (resolved: qid -> назва статті, by_seed: вихідна назва -> qid).
    """
    resolved = {}
    by_seed = {}
    for chunk in _chunks(titles, 50):
        data = http_get(UKWIKI_API, {
            "action": "query", "format": "json", "redirects": 1,
            "prop": "pageprops", "ppprop": "wikibase_item",
            "titles": "|".join(chunk),
        })
        pages = data["query"].get("pages", {})
        found_titles = set()
        norm = {}
        for m in data["query"].get("normalized", []) + data["query"].get("redirects", []):
            norm[m["to"]] = norm.get(m["from"], m["from"])
        for page in pages.values():
            qid = page.get("pageprops", {}).get("wikibase_item")
            if qid:
                orig = norm.get(page["title"], page["title"])
                resolved[qid] = page["title"]
                by_seed[orig] = qid
                found_titles.add(orig)
                found_titles.add(page["title"])
        for t in chunk:
            if t not in found_titles:
                hit = _search_ukwiki(t)
                if hit:
                    qid, real_title = hit
                    resolved[qid] = real_title
                    by_seed[t] = qid
                    log.append({"seed": t, "note": "fuzzy -> " + real_title})
                else:
                    log.append({"seed": t, "note": "NOT FOUND"})
    return resolved, by_seed


def _search_ukwiki(text):
    data = http_get(UKWIKI_API, {
        "action": "query", "format": "json", "list": "search",
        "srsearch": text, "srlimit": 1,
    })
    hits = data["query"]["search"]
    if not hits:
        return None
    title = hits[0]["title"]
    data = http_get(UKWIKI_API, {
        "action": "query", "format": "json", "redirects": 1,
        "prop": "pageprops", "ppprop": "wikibase_item", "titles": title,
    })
    for page in data["query"].get("pages", {}).values():
        qid = page.get("pageprops", {}).get("wikibase_item")
        if qid:
            return qid, page["title"]
    return None


# ----------------------------------------------------------------- entity fetch

def _chunks(seq, n):
    seq = list(seq)
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def fetch_entities(qids):
    """Batch wbgetentities: ukwiki sitelink, опис uk, label uk/en, claims."""
    out = {}
    for chunk in _chunks(qids, 48):
        data = http_get(WD_API, {
            "action": "wbgetentities", "format": "json",
            "ids": "|".join(chunk),
            "props": "sitelinks|descriptions|labels|claims",
            "languages": "uk|en",
        })
        for qid, ent in data.get("entities", {}).items():
            if "missing" in ent:
                continue
            claims = ent.get("claims", {})
            out[qid] = {
                "ukwiki": ent.get("sitelinks", {}).get("ukwiki", {}).get("title"),
                "description": ent.get("descriptions", {}).get("uk", {}).get("value"),
                "label": (ent.get("labels", {}).get("uk", {}) or
                          ent.get("labels", {}).get("en", {})).get("value"),
                "image": (_first_claim_str(claims, "P18")
                          or _first_claim_str(claims, "P41")
                          or _first_claim_str(claims, "P94")),
                "gender": _first_claim_id(claims, "P21"),
                "claims": claims,
            }
        time.sleep(0.2)
    return out


def _first_claim_str(claims, prop):
    for c in claims.get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, str):
            return v
    return None


def _first_claim_id(claims, prop):
    for c in claims.get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            return v["id"]
    return None


def claim_year(claims, props):
    """Перша дата з precision >= року за списком властивостей."""
    for prop in props:
        for c in claims.get(prop, []):
            dv = c.get("mainsnak", {}).get("datavalue", {}).get("value")
            if isinstance(dv, dict) and dv.get("precision", 0) >= 9:
                y = parse_wd_year(dv.get("time", ""))
                if y is not None:
                    return y
    return None


def parse_wd_year(iso):
    """'+1709-07-08T00:00:00Z' або '-0450-...' -> int рік."""
    if not iso:
        return None
    s = iso.lstrip("+")
    neg = s.startswith("-")
    if neg:
        s = s[1:]
    try:
        year = int(s.split("-")[0])
    except ValueError:
        return None
    return -year if neg else year


# ---------------------------------------------------------------- fame + facts

PAGEVIEWS_API_START = datetime.date(2015, 7, 1)  # раніше даних в API немає


def pageviews(title, months=None):
    """(всього переглядів, у середньому за рік).

    months=None -> весь доступний період (з липня 2015).
    Середньорічне рахується від фактичної кількості місяців з даними
    (щоб свіжі статті не програвали старим), але не менше ніж від 12
    (щоб разовий сплеск нової статті не завищував оцінку).
    """
    key = (title, months)
    if key in _pageviews_cache:
        return _pageviews_cache[key]
    today = datetime.date.today().replace(day=1)
    if months:
        start = today - datetime.timedelta(days=months * 31)
        start = max(start.replace(day=1), PAGEVIEWS_API_START)
    else:
        start = PAGEVIEWS_API_START
    url = PAGEVIEWS_URL.format(
        title=urllib.parse.quote(title.replace(" ", "_"), safe=""),
        start=start.strftime("%Y%m%d") + "00",
        end=today.strftime("%Y%m%d") + "00",
    )
    data = http_get(url)
    items = data.get("items", []) if data else []
    total = sum(i["views"] for i in items)
    annual = round(total / max(len(items), 12) * 12)
    _pageviews_cache[key] = (total, annual)
    time.sleep(0.05)
    return total, annual


_infobox_cache = {}
_FOUNDED_RE = re.compile(
    r"\|\s*(?:заснован[аеоиі][а-яіїє ]*|(?:дата|рік)[_ ]заснування)\s*=\s*([^\n]*)", re.I)


def infobox_founded_year(title, pick="max"):
    """Рік з поля «засноване/заснована» інфобоксу uk-wiki (None якщо нема).

    У Wikidata P571 буває не те, що очікують гравці: для міст — «перша
    згадка» (Одеса = 1500 замість 1794), для компаній — радянський попередник
    (Укрпошта = 1947 замість 1994). pick: "max" — найпізніший рік з поля
    (міста: «1415; 1794» -> 1794), "min" — найраніший (компанії: дата
    заснування зазвичай перша, далі йдуть реорганізації).
    """
    key = (title, pick)
    if key in _infobox_cache:
        return _infobox_cache[key]
    year = None
    try:
        data = http_get(UKWIKI_API, {
            "action": "query", "format": "json", "redirects": 1,
            "prop": "revisions", "rvprop": "content", "rvslots": "main",
            "rvsection": 0, "titles": title,
        })
        page = next(iter(data["query"]["pages"].values()))
        text = page["revisions"][0]["slots"]["main"]["*"]
        m = _FOUNDED_RE.search(text)
        if m:
            val = re.sub(r"<ref[^>]*/>", "", m.group(1))
            val = re.sub(r"<ref.*?(</ref>|$)", "", val)  # і обірвані ref-и
            years = [int(y) for y in re.findall(r"\b(\d{3,4})\b", val)
                     if 100 <= int(y) <= 2100]
            if years:
                if re.search(r"до\s*н\.?\s*е", val, re.I):
                    year = -min(years)
                else:
                    year = max(years) if pick == "max" else min(years)
    except (KeyError, IndexError, StopIteration):
        pass
    _infobox_cache[key] = year
    time.sleep(0.05)
    return year


def _summary(title):
    """REST summary статті: короткий факт + головне зображення.

    Зображення звідси — фолбек, коли у Wikidata нема P18 (типово для мемів
    з fair-use ілюстраціями, залитими локально в uk-wiki, а не на Commons).
    """
    if title in _summary_cache:
        return _summary_cache[title]
    data = http_get(SUMMARY_URL.format(
        title=urllib.parse.quote(title.replace(" ", "_"), safe="")))
    extract = (data or {}).get("extract") or None
    if extract and len(extract) > 350:
        cut = extract[:350]
        dot = cut.rfind(". ")
        extract = cut[:dot + 1] if dot > 80 else cut + "…"
    result = {
        "extract": extract,
        "image": (data or {}).get("thumbnail", {}).get("source"),
    }
    _summary_cache[title] = result
    time.sleep(0.05)
    return result


def fact_for(title):
    return _summary(title)["extract"]


# ------------------------------------------------------------------- categories

def candidates_from_part(part, defaults, report_log):
    """-> dict qid -> {label, year, links, gender} (з SPARQL або seeds)."""
    if part["type"] == "seed":
        entries = [{"title": t} if isinstance(t, str) else dict(t)
                   for t in part["titles"]]
        resolved, by_seed = resolve_seeds([e["title"] for e in entries], report_log)
        years = {}
        for e in entries:
            qid = by_seed.get(e["title"])
            if qid and e.get("year") is not None:
                years[qid] = int(e["year"])
        return {qid: {"label": None, "year": years.get(qid),
                      "links": None, "gender": None}
                for qid in resolved}
    rows = sparql(build_query(part, defaults))
    out = {}
    for row in rows:
        qid = row["item"]["value"].rsplit("/", 1)[-1]
        year = parse_wd_year(row["date"]["value"])
        if year is None:
            continue
        prev = out.get(qid)
        if prev is None or year < prev["year"]:
            out[qid] = {
                "label": row["itemLabel"]["value"],
                "year": year,
                "links": int(row["links"]["value"]),
                "gender": row.get("gender", {}).get("value"),
            }
    return out


# Глобальна мапа перейменувань qid -> назва (з config "name_overrides"):
# для назв, де рік — підказка або пастка, і безликих імен (церковні діячі)
NAME_OVERRIDES = {}
# Точкові виправлення року qid -> рік (з config "year_overrides"):
# коли і Wikidata, і інфобокс дають не те, що очікує гравець
YEAR_OVERRIDES = {}

_YEAR_FILM = re.compile(r"\(фільм,\s*\d{4}\)")
_YEAR_PARENS = re.compile(
    r"\s*\(\s*(?:з\s*)?\d{4}(?:\s*[—–-]\s*\d{2,4})?(?:\s*рок(?:у|ів))?\s*\)")
_YEAR_TAIL = re.compile(r"\s+\d{4}(?:\s*[—–-]\s*\d{2,4})?(?:\s+рок(?:у|ів))?$")


def strip_years(name):
    """Прибирає роки-підказки з назви: «(1941)», «(з 2014)», «... 1621».

    Безпечно для «2000 метрів до Андріївки» (не в дужках і не в кінці)
    та назв типу «1944» (нема пробілу перед роком).
    """
    name = _YEAR_FILM.sub("(фільм)", name)
    name = _YEAR_PARENS.sub("", name)
    name = _YEAR_TAIL.sub("", name)
    return name.strip()


# «імені <титул?> <Ім'я Прізвище>» -> «ім. <Прізвище>» (без хвостового пробілу)
_IMENI_RE = re.compile(
    r"\s+імені\s+((?:[а-яіїєґ'ʼ\-]+\s+)?"
    r"[А-ЯІЇЄҐ][\w'ʼ\-\.]*(?:\s+[А-ЯІЇЄҐ][\w'ʼ\-\.]*){0,2})")
# слова-наповнювачі інституційних назв, у порядку викидання
_FILLER_WORDS = [
    "національний", "національна", "академічний", "академічна",
    "державний", "державна", "обласний", "обласна",
    "муніципальний", "муніципальна", "український", "українська",
]


def shorten_name(name, limit=55):
    """Скорочує канцелярські назви установ, зберігаючи ідентичність.

    «Львівський національний академічний театр опери та балету
    імені Соломії Крушельницької» -> «Львівський театр опери та балету
    ім. Крушельницької». Правила застосовуються лише поки назва довша
    за limit: спершу «імені X Y» -> «ім. Y», далі по одному викидаються
    слова-наповнювачі.
    """
    if len(name) <= limit:
        return name
    name = _IMENI_RE.sub(lambda m: " ім. " + m.group(1).split()[-1], name, count=1)
    for word in _FILLER_WORDS:
        if len(name) <= limit:
            break
        name = re.sub(r"\b%s\s+" % word, "", name, count=1, flags=re.I)
    name = re.sub(r"\s{2,}", " ", name).strip()
    if name and name[0].islower():  # якщо викинули перше слово
        name = name[0].upper() + name[1:]
    return name


_PATRONYMIC = ("ович", "йович", "ьович", "івна", "ївна", "ич", "іч")


def pretty_name(name):
    """Прибирає по батькові з тризіркових ПІБ.

    'Чорновіл В'ячеслав Максимович' -> 'В'ячеслав Чорновіл'
    'Володимир Олександрович Зеленський' -> 'Володимир Зеленський'
    """
    tokens = name.split()
    if len(tokens) == 3:
        if tokens[1].lower().endswith(_PATRONYMIC):
            return f"{tokens[0]} {tokens[2]}"
        if tokens[2].lower().endswith(_PATRONYMIC):
            return f"{tokens[1]} {tokens[0]}"
    return name


def make_title(name, part, gender_qid):
    name = pretty_name(name)
    tpl = part.get("title", "{name}")
    if "{verb}" in tpl:
        female = gender_qid in (FEMALE, "Q6581072")
        verb = part.get("verb_f") if female else part.get("verb_m")
        return tpl.format(name=name, verb=verb or "")
    return tpl.format(name=name)


def run_category(cat, defaults, out_dir):
    print(f"\n=== {cat['slug']}: {cat.get('name', '')}")
    report = {"slug": cat["slug"], "seeds_log": [], "dropped": [], "cards": 0}
    parts = cat.get("parts") or [cat]

    merged = {}   # qid -> {part, label, year, links, gender}
    for part in parts:
        try:
            cands = candidates_from_part(part, defaults, report["seeds_log"])
        except Exception as e:
            print(f"  ! запит не вдався: {e}", file=sys.stderr)
            report["dropped"].append({"error": str(e)})
            continue
        for qid, info in cands.items():
            if qid not in merged:
                merged[qid] = {**info, "part": part}
    # Постійний бан-лист категорії: QID з config "exclude" ніколи не стають картками
    for qid in cat.get("exclude", []):
        if merged.pop(qid, None) is not None:
            report["dropped"].append({"qid": qid, "reason": "excluded in config"})

    print(f"  кандидатів: {len(merged)}")
    if not merged:
        return report

    entities = fetch_entities(merged.keys())
    min_views = cat.get("min_pageviews", defaults["min_pageviews"])
    pv_months = cat.get("pageviews_months", defaults.get("pageviews_months"))
    require_image = cat.get("require_image", defaults["require_image"])
    year_range = cat.get("year_range")

    cards = []
    for qid, info in merged.items():
        ent = entities.get(qid)
        part = info["part"]
        if not ent or not ent["ukwiki"]:
            report["dropped"].append({"qid": qid, "name": info.get("label"),
                                      "reason": "no uk-wiki article"})
            continue
        year = info["year"]
        if year is None:  # seed: дата з claims
            year = claim_year(ent["claims"], part.get("date_props", ["P571", "P585", "P577", "P569"]))
        if year is None:
            report["dropped"].append({"qid": qid, "name": ent["label"],
                                      "reason": "no date"})
            continue
        if cat.get("year_from_ukwiki_infobox"):
            year = infobox_founded_year(
                ent["ukwiki"], cat.get("infobox_year_pick", "max")) or year
        override_key = f"{cat['slug']}/{qid}"
        year = int(YEAR_OVERRIDES.get(override_key, YEAR_OVERRIDES.get(qid, year)))
        if year_range and not (
                (year_range[0] is None or year >= year_range[0]) and
                (year_range[1] is None or year < year_range[1])):
            continue
        image = ent["image"] or _summary(ent["ukwiki"])["image"]
        if require_image and not image:
            report["dropped"].append({"qid": qid, "name": ent["label"],
                                      "reason": "no image (P18/summary)"})
            continue
        views_total, views_annual = pageviews(ent["ukwiki"], pv_months)
        if views_annual < min_views:
            report["dropped"].append({"qid": qid, "name": ent["label"],
                                      "reason": f"pageviews {views_annual}/рік < {min_views}"})
            continue
        fact = fact_for(ent["ukwiki"]) or ent["description"]
        # ручний рік seed-картки не має суперечити рокам, згаданим у факті
        if info.get("year") is not None and part["type"] == "seed" and fact:
            fact_years = set(re.findall(r"\b(1[0-9]{3}|20[0-2][0-9])\b", fact))
            if fact_years and str(year) not in fact_years:
                report["dropped"].append({
                    "qid": qid, "name": ent["label"],
                    "reason": f"WARNING: ручний рік {year}, у факті {sorted(fact_years)} (картку залишено)",
                })
        raw_name = ent["label"] or info.get("label") or ent["ukwiki"]
        name = NAME_OVERRIDES.get(qid) or shorten_name(strip_years(raw_name))
        gender = info.get("gender") or ent.get("gender")
        cards.append({
            "qid": qid,
            "title": make_title(name, part, gender),
            "subtitle": ent["description"],
            "year": year,
            "fact": fact,
            "wikipediaSlug": ent["ukwiki"].replace(" ", "_"),
            "image": (image if image and image.startswith("http")
                      else image.replace(" ", "_") if image else None),
            "pageViews": views_total,
        })

    cards.sort(key=lambda c: -c["pageViews"])
    cards = cards[:cat.get("max_cards", defaults["max_cards"])]
    out_path = out_dir / f"{cat['slug']}.json"
    out_path.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    report["cards"] = len(cards)
    top = ", ".join(c["title"] for c in cards[:4])
    print(f"  карток: {len(cards)} -> {out_path.name}   (топ: {top})")
    return report


# ------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="кома-розділені slug категорій")
    ap.add_argument("--list", action="store_true", help="показати категорії")
    ap.add_argument("--config", default=str(Path(__file__).parent / "ua_categories.json"))
    ap.add_argument("--out", default=str(Path(__file__).parent.parent / "items-ua"))
    args = ap.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    NAME_OVERRIDES.update(config.get("name_overrides", {}))
    YEAR_OVERRIDES.update(config.get("year_overrides", {}))
    defaults = config["defaults"]
    cats = config["categories"]

    if args.list:
        for c in cats:
            print(f"{c['slug']:38} {c.get('name', '')}")
        return

    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        unknown = wanted - {c["slug"] for c in cats}
        if unknown:
            sys.exit(f"невідомі категорії: {', '.join(unknown)}")
        cats = [c for c in cats if c["slug"] in wanted]

    out_dir = Path(args.out)
    out_dir.mkdir(exist_ok=True)
    reports = []
    t0 = time.time()
    for cat in cats:
        try:
            reports.append(run_category(cat, defaults, out_dir))
        except Exception as e:
            print(f"  !! {cat['slug']} впала: {e}", file=sys.stderr)
            reports.append({"slug": cat["slug"], "error": str(e), "cards": 0})

    report_path = out_dir / "_report.json"
    merged = {}
    if report_path.exists():  # частковий запуск не затирає звіт інших категорій
        try:
            for r in json.loads(report_path.read_text(encoding="utf-8"))["categories"]:
                merged[r["slug"]] = r
        except (ValueError, KeyError):
            pass
    for r in reports:
        merged[r["slug"]] = r
    report_path.write_text(
        json.dumps({
            "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "total_cards": sum(r.get("cards", 0) for r in merged.values()),
            "categories": list(merged.values()),
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nГотово за {time.time() - t0:.0f}с. "
          f"Всього карток: {sum(r.get('cards', 0) for r in reports)}. "
          f"Звіт: {report_path}")


if __name__ == "__main__":
    main()
