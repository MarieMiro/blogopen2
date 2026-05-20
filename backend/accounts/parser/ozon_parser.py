import sys
import json
import time
import re

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium_stealth import stealth
from bs4 import BeautifulSoup


def init_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1400,900")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    options.binary_location = "/usr/bin/chromium"

    driver = webdriver.Chrome(options=options)

    stealth(
        driver,
        languages=["ru-RU", "ru", "en-US", "en"],
        vendor="Google Inc.",
        platform="Linux x86_64",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
    )

    return driver


def scroll_page(driver, steps=5):
    for _ in range(steps):
        driver.execute_script("window.scrollBy(0, 600)")
        time.sleep(0.4)
    time.sleep(1)


def parse_seller_page(url: str) -> dict:
    driver = None
    try:
        driver = init_driver()
        driver.set_page_load_timeout(30)
        driver.get(url)

        time.sleep(5)
        scroll_page(driver, steps=6)

        html = driver.page_source
        soup = BeautifulSoup(html, "html.parser")

        # ── Отладка в stderr (видно в Render Logs) ──
        title_tag = soup.find("title")
        h1_tags = [h.get_text(strip=True) for h in soup.find_all("h1")]
        og_title = soup.find("meta", property="og:title")
        og_desc = soup.find("meta", property="og:description")
        page_text = soup.get_text(" ", strip=True)

        print(f"DEBUG title: {title_tag}", file=sys.stderr)
        print(f"DEBUG h1: {h1_tags}", file=sys.stderr)
        print(f"DEBUG og:title: {og_title}", file=sys.stderr)
        print(f"DEBUG og:desc: {og_desc}", file=sys.stderr)
        print(f"DEBUG text[:300]: {page_text[:300]}", file=sys.stderr)

        result = {
            "brand_name": "",
            "sphere": "",
            "topics": [],
            "description": "",
            "rating": None,
            "products_count": None,
            "source_url": url,
        }

        # 1. Название
        if h1_tags:
            result["brand_name"] = h1_tags[0]

        if not result["brand_name"] and og_title:
            raw = og_title.get("content", "")
            result["brand_name"] = re.sub(r"\s*[–—-]\s*Ozon.*$", "", raw).strip()

        # 2. Описание
        if og_desc:
            result["description"] = og_desc.get("content", "").strip()

        # 3. Категории
        categories = []

        breadcrumbs = soup.find_all("a", href=re.compile(r"/category/"))
        for bc in breadcrumbs[:5]:
            text = bc.get_text(strip=True)
            if text and len(text) > 2:
                categories.append(text)

        if not categories:
            meta_kw = soup.find("meta", attrs={"name": "keywords"})
            if meta_kw:
                kw = meta_kw.get("content", "")
                categories = [k.strip() for k in kw.split(",") if k.strip()][:5]

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
        count_match = re.search(r"(\d[\d\s]*)\s*товар", page_text, re.IGNORECASE)
        if count_match:
            try:
                result["products_count"] = int(count_match.group(1).replace(" ", ""))
            except ValueError:
                pass

        return result

    except Exception as e:
        print(f"DEBUG exception: {e}", file=sys.stderr)
        return {"error": str(e)}

    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


CATEGORY_MAP = {
    "beauty":    ["красота", "уход", "косметика", "парфюм", "beauty"],
    "food":      ["еда", "продукт", "напиток", "чай", "кофе", "food"],
    "clothes":   ["одежда", "обувь", "аксессуар", "мода", "fashion"],
    "tech":      ["электроника", "техника", "гаджет", "смартфон", "ноутбук"],
    "home":      ["дом", "мебель", "интерьер", "кухня", "декор"],
    "sport":     ["спорт", "фитнес", "outdoor", "туризм"],
    "kids":      ["детск", "игрушк", "baby", "для детей"],
    "education": ["книг", "образован", "обучен", "канцеляр"],
    "pets":      ["животн", "зоо", "питомц", "для кошек", "для собак"],
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