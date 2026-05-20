"""
backend/accounts/parser/ozon_parser.py

Парсит страницу бренда/магазина Ozon через ScraperAPI.
ScraperAPI сам рендерит JS и обходит капчу.
"""

import sys
import json
import os
import re
import requests
from bs4 import BeautifulSoup


SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")


def fetch_page(url: str) -> str:
    """
    Загружает страницу через ScraperAPI с рендерингом JS.
    render=true — ScraperAPI запускает headless браузер на своей стороне.
    """
    if not SCRAPER_API_KEY:
        raise ValueError("SCRAPER_API_KEY не задан в переменных окружения")

    api_url = "https://api.scraperapi.com/"
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        "render": "true",          # рендерит JS как браузер
        "country_code": "ru",      # российский IP — меньше подозрений
        "device_type": "desktop",
    }

    resp = requests.get(api_url, params=params, timeout=70)
    resp.raise_for_status()
    return resp.text


def parse_seller_page(url: str) -> dict:
    result = {
        "brand_name": "",
        "sphere": "",
        "topics": [],
        "description": "",
        "rating": None,
        "products_count": None,
        "source_url": url,
    }

    try:
        html = fetch_page(url)
    except Exception as e:
        return {"error": f"Не удалось загрузить страницу: {e}"}

    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(" ", strip=True)

    # ── Отладка ──────────────────────────────────────────────────────────
    print(f"DEBUG title: {soup.find('title')}", file=sys.stderr)
    print(f"DEBUG h1: {[h.get_text(strip=True) for h in soup.find_all('h1')]}", file=sys.stderr)
    og_title_tag = soup.find("meta", property="og:title")
    print(f"DEBUG og:title: {og_title_tag}", file=sys.stderr)
    print(f"DEBUG text[:400]: {page_text[:400]}", file=sys.stderr)
    # ─────────────────────────────────────────────────────────────────────

    # 1. Название бренда/магазина
    h1 = soup.find("h1")
    if h1:
        result["brand_name"] = h1.get_text(strip=True)

    if not result["brand_name"] and og_title_tag:
        raw = og_title_tag.get("content", "")
        result["brand_name"] = re.sub(r"\s*[–—-]\s*Ozon.*$", "", raw).strip()

    # Дополнительно ищем название в title если h1 пустой
    if not result["brand_name"]:
        title_tag = soup.find("title")
        if title_tag:
            raw = title_tag.get_text(strip=True)
            result["brand_name"] = re.sub(r"\s*[–—|]\s*Ozon.*$", "", raw).strip()

    # 2. Описание
    og_desc = soup.find("meta", property="og:description")
    if og_desc:
        result["description"] = og_desc.get("content", "").strip()

    # Если og:description пустой — берём первый абзац страницы
    if not result["description"]:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 40:
                result["description"] = text[:300]
                break

    # 3. Категории → sphere и topics
    categories = []

    # Вариант А: ссылки на категории
    for a in soup.find_all("a", href=re.compile(r"/category/")):
        text = a.get_text(strip=True)
        if text and 2 < len(text) < 60:
            categories.append(text)

    # Вариант Б: хлебные крошки (часто class содержит "breadcrumb")
    if not categories:
        for bc in soup.find_all(class_=re.compile(r"breadcrumb|Breadcrumb", re.I)):
            text = bc.get_text(strip=True)
            if 2 < len(text) < 60:
                categories.append(text)

    # Вариант В: мета keywords
    if not categories:
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw:
            kw = meta_kw.get("content", "")
            categories = [k.strip() for k in kw.split(",") if k.strip()][:5]

    # Вариант Г: ищем по тексту страницы типичные категории Ozon
    if not categories:
        ozon_categories = [
            "Одежда", "Обувь", "Красота", "Здоровье", "Электроника",
            "Дом и сад", "Детские товары", "Спорт", "Продукты", "Книги",
            "Зоотовары", "Автотовары", "Ювелирные украшения",
        ]
        for cat in ozon_categories:
            if cat.lower() in page_text.lower():
                categories.append(cat)
                if len(categories) >= 3:
                    break

    print(f"DEBUG categories: {categories}", file=sys.stderr)

    if categories:
        result["sphere"] = categories[0]
        result["topics"] = map_categories_to_topics(categories)

    # 4. Рейтинг
    rating_match = re.search(r"рейтинг[^\d]{0,20}(\d[.,]\d)", page_text, re.IGNORECASE)
    if rating_match:
        try:
            result["rating"] = float(rating_match.group(1).replace(",", "."))
        except ValueError:
            pass

    # 5. Количество товаров
    count_match = re.search(r"(\d[\d\s]{0,6})\s*товар", page_text, re.IGNORECASE)
    if count_match:
        try:
            result["products_count"] = int(count_match.group(1).replace(" ", ""))
        except ValueError:
            pass

    return result


CATEGORY_MAP = {
    "beauty":    ["красота", "уход", "косметика", "парфюм", "beauty", "здоровье"],
    "food":      ["еда", "продукт", "напиток", "чай", "кофе", "food"],
    "clothes":   ["одежда", "обувь", "аксессуар", "мода", "fashion", "ювелир"],
    "tech":      ["электроника", "техника", "гаджет", "смартфон", "ноутбук", "авто"],
    "home":      ["дом", "мебель", "интерьер", "кухня", "декор", "сад"],
    "sport":     ["спорт", "фитнес", "outdoor", "туризм"],
    "kids":      ["детск", "игрушк", "baby", "для детей"],
    "education": ["книг", "образован", "обучен", "канцеляр"],
    "pets":      ["животн", "зоо", "питомц", "для кошек", "для собак", "зоотовар"],
}


def map_categories_to_topics(categories: list) -> list:
    found = []
    cats_lower = " ".join(categories).lower()
    for topic, keywords in CATEGORY_MAP.items():
        if any(kw in cats_lower for kw in keywords):
            found.append(topic)
    return found if found else ["services"]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL не передан"}))
        sys.exit(1)

    url = sys.argv[1]
    result = parse_seller_page(url)
    print(json.dumps(result, ensure_ascii=False))