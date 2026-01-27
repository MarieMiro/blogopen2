import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./brandBloggers.css";

import { API_BASE } from "../../api";


const RUS_CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Омск",
  "Ростов-на-Дону",
  "Уфа",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
];

const PLATFORMS = [
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "vk", label: "VK" },
];

export default function BrandBloggers() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    city: "",
    platform: "",
    topic: "",
    followers_min: "",
    followers_max: "",
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [openingChatId, setOpeningChatId] = useState(null);
  const [mode, setMode] = useState("rec");
  const setField = (name, value) => setFilters((p) => ({ ...p, [name]: value }));

  const resetFilters = () =>
    setFilters({
      city: "",
      platform: "",
      topic: "",
      followers_min: "",
      followers_max: "",
    });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (String(v ?? "").trim() !== "") p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError("");
        setLoading(true);

        const url = `${API_BASE}/api/bloggers/${mode === "all" ? "?mode=all" : ""}`;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить блогеров");
          return;
        }

        if (alive) setItems(data.results || []);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [queryString, mode]);

  // Открыть/создать диалог и перейти в Messages
  const openChat = async (profileId) => {
  try {
    setOpeningChatId(profileId);

    const res = await fetch(`${API_BASE}/api/chat/with/${profileId}/`, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Не удалось открыть чат");
      return;
    }

    // переходим в сообщения, открываем нужный диалог
    navigate("/dashboard/brand/messages", { state: { convId: data.conversation_id } });
  } catch (e) {
    alert("Ошибка соединения с сервером");
  } finally {
    setOpeningChatId(null);
  }
};

  return (
    <div className="bb">
      <div className="bb__head">
        <h1 className="bb__title">База блогеров</h1>

        <div className="bb__tools">
          <div className="bb__filters">
            <div className="bb__filter">
              <div className="bb__label">Город</div>
              <select
                className="bb__input"
                value={filters.city}
                onChange={(e) => setField("city", e.target.value)}
              >
                <option value="">Все</option>
                {RUS_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="bb__filter">
              <div className="bb__label">Соцсеть</div>
              <select
                className="bb__input"
                value={filters.platform}
                onChange={(e) => setField("platform", e.target.value)}
              >
                <option value="">Все</option>
                {PLATFORMS.
map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bb__filter bb__filter--wide">
              <div className="bb__label">Тематика</div>
              <input
                className="bb__input"
                placeholder="beauty, lifestyle, food…"
                value={filters.topic}
                onChange={(e) => setField("topic", e.target.value)}
              />
            </div>

            <div className="bb__filter">
              <div className="bb__label">Подписчики от</div>
              <input
                className="bb__input"
                inputMode="numeric"
                placeholder="10000"
                value={filters.followers_min}
                onChange={(e) => setField("followers_min", e.target.value)}
              />
            </div>

            <div className="bb__filter">
              <div className="bb__label">Подписчики до</div>
              <input
                className="bb__input"
                inputMode="numeric"
                placeholder="200000"
                value={filters.followers_max}
                onChange={(e) => setField("followers_max", e.target.value)}
              />
            </div>

            <button type="button" className="bb__reset" onClick={resetFilters}>
              Сбросить
            </button>
          </div>

          <div className="bb__count">
            Найдено: <b>{items.length}</b>
          </div>
        </div>
      </div>

      {error && <div className="bb__error">{error}</div>}

      <div className="bbTabs">
  <button
    type="button"
    className={`bbTab ${mode === "rec" ? "isActive" : ""}`}
    onClick={() => setMode("rec")}
  >
    Рекомендации
  </button>

  <button
    type="button"
    className={`bbTab ${mode === "all" ? "isActive" : ""}`}
    onClick={() => setMode("all")}
  >
    Все блогеры
  </button>
</div>

      {loading ? (
        <div className="bb__loading">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="bb__loading">Ничего не найдено по выбранным фильтрам.</div>
      ) : (
        <div className="bb__grid">
          {items.map((b) => (
            <article className="bbCard" key={b.id}>
              <div className="bbCard__photoWrap">
                {b.avatar_url ? (
                  <img
                    className="bbCard__photo"
                    src={`${API_BASE}${b.avatar_url}`}
                    alt={b.nickname || "Blogger"}
                  />
                ) : (
                  <div className="bbCard__photo bbCard__photo--empty">Фото</div>
                )}
              </div>

              <div className="bbCard__body">
                <div className="bbCard__name">{b.nickname || "Без ника"}</div>

                <div className="bbCard__meta">
                  <span className="bbTag">{b.platform || "Платформа"}</span>
                  <span className="bbTag">
                    {b.followers
                      ? `${Number(b.followers).toLocaleString("ru-RU")} подписчиков`
                      : "Подписчики"}
                  </span>
                  <span className="bbTag">{b.city || "Город"}</span>
                </div>
              </div>

              <div className="bbCard__actions">
                <Link className="bbBtn" to={`/dashboard/brand/bloggers/${b.id}`}>
                  Профиль
                </Link>

                <button
                  className="bbBtn bbBtn--primary"
                  type="button"
                  onClick={() => openChat(b.id)}
                  disabled={openingChatId === b.id}
                >
                  {openingChatId === b.id ? "Открываю…" : "Написать"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}