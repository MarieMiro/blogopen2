import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./bloggerPublicProfile.css";

const API_BASE = "http://localhost:8000";

export default function BloggerPublicProfile() {
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

        const res = await fetch(`${API_BASE}/api/bloggers/${id}/`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (alive) setError(json.error || "Не удалось загрузить профиль");
          return;
        }
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => (alive = false);
  }, [id]);

  const avatarSrc = useMemo(() => {
    if (!data?.avatar_url) return "";
    return data.avatar_url.startsWith("http")
      ? data.avatar_url
      : `${API_BASE}${data.avatar_url}`;
  }, [data]);


  const socials = useMemo(() => {
    if (!data) return [];

    if (Array.isArray(data.socials)) {
      return data.socials
        .filter((s) => s?.url)
        .map((s) => ({
          name: s.name || "Соцсеть",
          url: s.url,
        }));
    }

    
    if (data.platform_url) {
      return [
        {
          name: data.platform || "Платформа",
          url: data.platform_url,
        },
      ];
    }

    return [];
  }, [data]);

  if (loading) return <div className="muted">Загрузка профиля…</div>;

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
        {/* ЛЕВАЯ КОЛОНКА */}
        <aside className="bpp__left">
          <div className="bpp__photoWrap">
            {avatarSrc ? (
              <img
                className="bpp__photo"
                src={avatarSrc}
                alt={data.nickname || "Blogger"}
              />
            ) : (
              <div className="bpp__photoEmpty">Фото</div>
            )}
          </div>

          <button className="bpp__btn bpp__btn--primary" type="button">
            Написать
          </button>
        </aside>

        {/* ПРАВАЯ КОЛОНКА */}
        <section className="bpp__body">
          <h1 className="bpp__name">{data.nickname || "Без ника"}</h1>

         
          <div className="bpp__socials">
            {socials.length ? (
              socials.map((s, idx) => (
                <div className="bpp__social" key={idx}>
                  <span className="bpp__socialName">{s.name}</span>
                  <a
                    className="bpp__socialLink"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.url}
                  </a>
                </div>
              ))
            ) : (
              <div className="bpp__social muted">Соцсети не указаны</div>
            )}
          </div>

   
          <div className="bpp__table">
            <div className="bpp__tr">
              <div className="bpp__th">Платформа</div>
              <div className="bpp__td">{data.platform || "—"}</div>
            </div>

            <div className="bpp__tr">
              <div className="bpp__th">Подписчики</div>
              <div className="bpp__td">
                {data.followers
                  ? Number(data.followers).toLocaleString("ru-RU")
                  : "—"}
              </div>
            </div>

            <div className="bpp__tr">
              <div className="bpp__th">Город</div>
              <div className="bpp__td">{data.city || "—"}</div>
            </div>

            <div className="bpp__tr">
              <div className="bpp__th">Тематика</div>
              <div className="bpp__td">{data.topic || "—"}</div>
            </div>

            <div className="bpp__tr">
              <div className="bpp__th">Форматы</div>
              <div className="bpp__td">{data.formats || "—"}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}