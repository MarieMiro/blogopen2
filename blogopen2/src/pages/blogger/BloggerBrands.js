import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "./bloggerBrands.css";

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


const SPHERES = [
  { value: "beauty", label: "Beauty" },
  { value: "food", label: "Food" },
  { value: "clothes", label: "Одежда" },
  { value: "tech", label: "Техника" },
  { value: "education", label: "Образование" },
  { value: "services", label: "Услуги" },
];

export default function BloggerBrands() {
  const [filters, setFilters] = useState({
    city: "",
    sphere: "",
    q: "",
    budget_min: "",
    budget_max: "",
  });
  const [openingChatId, setOpeningChatId] = useState(null);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("rec"); // "rec" | "all"
  const setField = (name, value) => setFilters((p) => ({ ...p, [name]: value }));

  const resetFilters = () =>
    setFilters({
      city: "",
      sphere: "",
      q: "",
      budget_min: "",
      budget_max: "",
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

        
        const url = `${API_BASE}/api/brands/${mode === "all" ? "?mode=all" : ""}`;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить бренды");
          return;
        }

        if (alive) setItems(data.results || []);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => (alive = false);
  }, [queryString, mode]);

  const openChat = async (profileId) => {
  try {
    setOpeningChatId(profileId);

    const res = await fetch(`${API_BASE}/api/chat/with/${profileId}/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Не удалось открыть чат");
      return;
    }

    // переходим в сообщения блогера и открываем нужный диалог
    navigate("/dashboard/blogger/messages", { state: { convId: data.conversation_id } });
  } finally {
    setOpeningChatId(null);
  }
};


  // Фильтрация, потом надо из бэка
  const filtered = useMemo(() => {
    const q = (filters.q || "").trim().toLowerCase();
    const city = (filters.city || "").trim().toLowerCase();
    const sphere = (filters.sphere || "").trim().toLowerCase();

    const minB = (filters.budget_min || "").trim();
    const maxB = (filters.budget_max || "").trim();

    
    const parseBudget = (v) => {
      const n = String(v || "").replace(/\s/g, "").match(/\d+/g);
      if (!n) return null;
  
      return Number(n[0]);
    };

    const minNum = minB ? Number(minB) : null;
    const maxNum = maxB ? Number(maxB) : null;

    return items.filter((b) => {
      const hay = `${b.brand_name || ""} ${b.sphere || ""} ${b.city || ""} ${b.about || ""} ${b.budget || ""}`.toLowerCase();

      if (q && !hay.includes(q)) return false;
      if (city && String(b.city || "").toLowerCase() !== city) return false;

      if (sphere) {
        
        if (!String(b.sphere || "").toLowerCase().includes(sphere)) return false;
      }

      if (minNum !== null || maxNum !== null) {
        const bn = parseBudget(b.budget);
        if (bn === null) return false;
        if (minNum !== null && bn < minNum) return false;
        if (maxNum !== null && bn > maxNum) return false;
      }

      return true;
    });
  }, [items, filters]);

  return (
    <div className="bb">
      <div className="bb__head">
        <h1 className="bb__title">База брендов</h1>

        
        <div className="bb__tools">
          <div className="bb__filters">
            {/* Город */}
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

            {/* Сфера */}
            <div className="bb__filter">
              <div className="bb__label">Сфера</div>
              <select
                className="bb__input"
                value={filters.sphere}
                onChange={(e) => setField("sphere", e.target.value)}
              >
                <option value="">Все</option>
                {SPHERES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Поиск */}
            <div className="bb__filter bb__filter--wide">
              <div className="bb__label">Поиск</div>
              <input
                className="bb__input"
                placeholder="Название, описание…"
                value={filters.q}
                onChange={(e) => setField("q", e.target.value)}
              />
            </div>

            {/* Бюджет  */}
            <div className="bb__filter">
              <div className="bb__label">Бюджет от</div>
              <input
                className="bb__input"
                inputMode="numeric"
                placeholder="10000"
                value={filters.budget_min}
                onChange={(e) => setField("budget_min", e.target.value)}
              />
            </div>

            <div className="bb__filter">
              <div className="bb__label">Бюджет до</div>
              <input
                className="bb__input"
                inputMode="numeric"
                placeholder="200000"
                value={filters.budget_max}
                onChange={(e) => setField("budget_max", e.target.value)}
              />
            </div>

            <button type="button" className="bb__reset" onClick={resetFilters}>
              Сбросить
            </button>
          </div>

          <div className="bb__count">
            Найдено: <b>{filtered.length}</b>
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
    Все бренды
  </button>
</div>

      {loading ? (
        <div className="bb__loading">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="bb__loading">Ничего не найдено по выбранным фильтрам.</div>
      ) : (
        <div className="bb__grid">
          {filtered.map((b) => (
            <article className="bbCard" key={b.id}>
              <div className="bbCard__photoWrap">
                {b.avatar_url ? (
                  <img
                    className="bbCard__photo"
                    src={`${API_BASE}${data.avatar_url}`}
                    alt={b.brand_name || "Brand"}
                  />
                ) : (
                  <div className="bbCard__photo bbCard__photo--empty">Лого</div>
                )}
              </div>

              <div className="bbCard__body">
                <div className="bbCard__name">{b.brand_name || "Без названия"}</div>

                <div className="bbCard__meta">
                  <span className="bbTag">{b.city || "Город"}</span>
                  <span className="bbTag">{b.sphere || "Сфера"}</span>
                 
                </div>

                <div className="bbCard__topic">{b.about || "Описание не указано"}</div>
              </div>
              <div className="bbCard__actions">
                <Link className="bbBtn" to={`/dashboard/blogger/brands/${b.id}`}>
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