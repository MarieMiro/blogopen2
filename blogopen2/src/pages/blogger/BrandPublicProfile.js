import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./brandPublicProfile.css";

const API_BASE = "http://localhost:8000";

export default function BrandPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

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

      <div className="bpp__card">
        {/* LEFT */}
        <div className="bpp__left">
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

          <div className="bpp__leftActions">
            <button className="bpp__btn bpp__btn--primary" type="button">
              Написать
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bpp__body">
          <h1 className="bpp__name">{data.brand_name || "Без названия"}</h1>

          
          <div className="bpp__rows">
            <div className="bpp__row">
              <div className="bpp__label">Сфера</div>
              <div className="bpp__value">{data.sphere || "—"}</div>
            </div>

            <div className="bpp__row">
              <div className="bpp__label">Город</div>
              <div className="bpp__value">{data.city || "—"}</div>
            </div>

            <div className="bpp__row">
              <div className="bpp__label">Бюджет</div>
              <div className="bpp__value">{data.budget || "—"}</div>
            </div>

            <div className="bpp__row">
              <div className="bpp__label">Описание</div>
              <div className="bpp__value">{data.about || "—"}</div>
            </div>

            <div className="bpp__row">
              <div className="bpp__label">Контактное лицо</div>
              <div className="bpp__value">{data.contact_person || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}