import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./brandPublicProfile.css";

import { API_BASE } from "../../api";

export default function BrandPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const onWrite = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/chat/with/${id}/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Не удалось открыть чат");
      return;
    }

    navigate("/dashboard/blogger/messages", {
      state: { convId: data.conversation_id },
    });
  } catch {
    alert("Ошибка соединения с сервером");
  }
};


  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError("");
        setLoading(true);

        const res = await fetch(`${API_BASE}/api/brands/${id}/`, {
          credentials: "include",
        });

        const json = await res.json();
        const payload = json?.result ?? json;
        if (alive) setData(payload);
        if (!res.ok) {
          if (alive) setError(json.error || "Не удалось загрузить бренд");
          return;
        }

        if (alive) setData(json);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => (alive = false);
  }, [id]);

  if (loading) return <div className="muted">Загрузка…</div>;

  if (error) {
    return (
      <div className="bpp">
        <button className="bpp__back" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="bpp__error">{error}</div>
      </div>
    );
  }

  return (
  <div className="bpp">
    <button className="bpp__back" onClick={() => navigate(-1)}>
      ← Назад
    </button>

    <div className="bpp__layout">
      {/* LEFT */}
      <aside className="bpp__left">
        <div className="bpp__photoWrap">
          {data.avatar_url ? (
            <img
              className="bpp__photo"
              src={`${API_BASE}${data.avatar_url}`}
              alt={data.brand_name || "Brand"}
            />
          ) : (
            <div className="bpp__photoEmpty">Лого</div>
          )}
        </div>

      <button
        className="bpp__btn bpp__btn--primary"
        type="button"
        onClick={onWrite}
      >
        Написать
      </button>
      </aside>

      {/* RIGHT */}
      <main className="bpp__body">
        <h1 className="bpp__name">{data.brand_name || "Без названия"}</h1>

        {/* Чипы сверху */}
        <div className="bpp__chips">
          <span className="bpp__chip">{data.city || "Город —"}</span>
          {Array.isArray(data.topics) && data.topics.length > 0 ? (
            <span className="bpp__chip">{data.topics.join(" • ")}</span>
          ) : (
            <span className="bpp__chip">Тематика —</span>
          )}
        </div>

        <div className="bpp__rows">
          <div className="bpp__row">
            <div className="bpp__label">Город</div>
            <div className="bpp__value">{data.city || "—"}</div>
          </div>

          <div className="bpp__row">
            <div className="bpp__label">Тематика бренда</div>
            <div className="bpp__value">
              {Array.isArray(data.topics) && data.topics.length > 0 ? (
                <div className="bpp__topics">
                  {data.topics.map((t) => (
                    <span className="bpp__topic" key={t}>{t}</span>
                  ))}
                </div>
              ) : "—"}
            </div>
          </div>

          <div className="bpp__row">
            <div className="bpp__label">Бюджет</div>
            <div className="bpp__value">{data.budget || "—"}</div>
          </div>

          <div className="bpp__row">
            <div className="bpp__label">Описание компании</div>
            <div className="bpp__value">{data.about || "—"}</div>
          </div>

          <div className="bpp__row">
            <div className="bpp__label">Контактное лицо</div>
            <div className="bpp__value">{data.contact_person || "—"}</div>
          </div>
        </div>
      </main>
    </div>
  </div>
);
}