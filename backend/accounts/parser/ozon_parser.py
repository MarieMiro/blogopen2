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
    if not SCRAPER_API_KEY:
        raise ValueError("SCRAPER_API_KEY не задан")

    api_url = "https://api.scraperapi.com/"
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        # render=true убираем — пробуем без JS рендеринга
        "country_code": "ru",
        "device_type": "desktop",
        "premium": "true",  # premium прокси — лучше обходят блокировки
    }

    resp = requests.get(api_url, params=params, timeout=60)
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

    # Извлекаем ID бренда из URL
    # https://www.ozon.ru/brand/sela-24124695/ → 24124695
    match = re.search(r"-(\d+)/?$", url)
    if not match:
        return {"error": "Не удалось извлечь ID бренда из URL. Убедитесь что ссылка ведёт на страницу бренда Ozon."}

    brand_id = match.group(1)
    print(f"DEBUG brand_id: {brand_id}", file=sys.stderr)

    # Внутренний API Ozon для получения данных бренда
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "Referer": "https://www.ozon.ru/",
        "Origin": "https://www.ozon.ru",
    }

    # Пробуем несколько внутренних эндпоинтов
    endpoints = [
        f"https://www.ozon.ru/api/composer-api.bff/page/json/brand?brand_id={brand_id}",
        f"https://www.ozon.ru/api/entrypoint-api.bff/page/json/brand?brand_id={brand_id}",
        f"https://www.ozon.ru/api/composer-api.bff/page/json/v2/brand?brand_id={brand_id}",
    ]

    data = None
    for endpoint in endpoints:
        try:
            resp = requests.get(endpoint, headers=headers, timeout=15)
            print(f"DEBUG endpoint {endpoint}: status={resp.status_code}", file=sys.stderr)
            if resp.status_code == 200:
                data = resp.json()
                print(f"DEBUG api response keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}", file=sys.stderr)
                break
        except Exception as e:
            print(f"DEBUG endpoint error: {e}", file=sys.stderr)
            continue

    if data and isinstance(data, dict):
        # Пробуем извлечь название
        brand_name = (
            data.get("brand", {}).get("name") or
            data.get("name") or
            data.get("title") or
            data.get("seo", {}).get("title") or
            ""
        )
        result["brand_name"] = brand_name

        # Описание
        result["description"] = (
            data.get("brand", {}).get("description") or
            data.get("description") or
            ""
        )[:300]

        # Категории
        categories = data.get("categories", [])
        if isinstance(categories, list):
            cat_names = [c.get("name", "") for c in categories if c.get("name")]
            if cat_names:
                result["sphere"] = cat_names[0]
                result["topics"] = map_categories_to_topics(cat_names)

        print(f"DEBUG brand_name: {result['brand_name']}", file=sys.stderr)
        print(f"DEBUG description: {result['description'][:100]}", file=sys.stderr)

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