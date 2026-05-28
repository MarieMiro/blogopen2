import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./bloggerPublicProfile.css";
import { API_BASE } from "../../api";

const PLATFORM_ICONS = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶️",
  telegram: "✈️",
  vk: "💙",
};

export default function BloggerPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/bloggers/${id}/`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(json.error || "Не удалось загрузить профиль"); return; }
        if (alive) setData(json);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const avatarSrc = useMemo(() => {
    if (!data?.avatar_url) return "";
    return data.avatar_url.startsWith("http") ? data.avatar_url : `${API_BASE}${data.avatar_url}`;
  }, [data]);

  const socials = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.socials)) return data.socials.filter((s) => s?.url).map((s) => ({ name: s.name || "Соцсеть", url: s.url }));
    if (data.platform_url) return [{ name: data.platform || "Платформа", url: data.platform_url }];
    return [];
  }, [data]);

  // Тематики — берём topics (массив) или topic (строка)
  const topics = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.topics) && data.topics.length) return data.topics;
    if (data.topic) return data.topic.split(",").map((t) => t.trim()).filter(Boolean);
    return [];
  }, [data]);

  const openChat = async () => {
    try {
      setOpeningChat(true);
      const res = await fetch(`${API_BASE}/api/chat/with/${id}/`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || "Не удалось открыть чат"); return; }
      navigate("/dashboard/brand/messages", { state: { convId: json.conversation_id } });
    } catch {
      alert("Ошибка соединения с сервером");
    } finally {
      setOpeningChat(false);
    }
  };

  if (loading) return <div className="muted" style={{ padding: 24 }}>Загрузка профиля…</div>;

  if (error) {
    return (
      <div className="bpp">
        <button className="bpp__back" onClick={() => navigate(-1)}>← Назад</button>
        <div className="bpp__error">{error}</div>
      </div>
    );
  }

  const platformIcon = PLATFORM_ICONS[data.platform?.toLowerCase()] || "🔗";

  return (
    <div className="bpp">
      <button className="bpp__back" onClick={() => navigate(-1)}>← Назад</button>

      <div className="bpp__card">

        {/* LEFT */}
        <aside className="bpp__left">
          <div className="bpp__photoWrap">
            {avatarSrc ? (
              <img className="bpp__photo" src={avatarSrc} alt={data.nickname || "Blogger"} />
            ) : (
              <div className="bpp__photoEmpty">
                <span>👤</span>
              </div>
            )}

            {/* Бейдж верификации */}
            {data.verification_status === "approved" && (
              <div className="bpp__verBadge">✔ Верифицирован</div>
            )}
          </div>

          {/* Имя и город под фото */}
          <div className="bpp__leftInfo">
            <h1 className="bpp__name">{data.nickname || "Без ника"}</h1>
            {data.city && <p className="bpp__city muted">📍 {data.city}</p>}
          </div>

          {/* Тематики */}
          {topics.length > 0 && (
            <div className="bpp__topics">
              {topics.map((t) => (
                <span key={t} className="bpp__topicChip">{t}</span>
              ))}
            </div>
          )}

          {/* Кнопка написать */}
          <button className="bpp__btn bpp__btn--primary" type="button" onClick={openChat} disabled={openingChat}>
            {openingChat ? "Открываю…" : "✉ Написать"}
          </button>
        </aside>

        {/* RIGHT */}
        <section className="bpp__body">

          {/* Статы — карточки */}
          <div className="bpp__stats">
            <div className="bpp__stat">
              <span className="bpp__statIcon">{platformIcon}</span>
              <div>
                <div className="bpp__statVal">{data.platform || "—"}</div>
                <div className="bpp__statLabel">Платформа</div>
              </div>
            </div>

            <div className="bpp__stat">
              <span className="bpp__statIcon">👥</span>
              <div>
                <div className="bpp__statVal">
                  {data.followers ? Number(data.followers).toLocaleString("ru-RU") : "—"}
                </div>
                <div className="bpp__statLabel">Подписчиков</div>
              </div>
            </div>

            {data.formats && (
              <div className="bpp__stat bpp__stat--wide">
                <span className="bpp__statIcon">🎯</span>
                <div>
                  <div className="bpp__statVal">{data.formats}</div>
                  <div className="bpp__statLabel">Форматы</div>
                </div>
              </div>
            )}
          </div>

          {/* Ссылки на соцсети */}
          {socials.length > 0 && (
            <div className="bpp__section">
              <h3 className="bpp__sectionTitle">Соцсети</h3>
              <div className="bpp__socialsList">
                {socials.map((s, idx) => (
                  <a key={idx} className="bpp__socialLink" href={s.url} target="_blank" rel="noreferrer">
                    <span className="bpp__socialPlatform">
                      {PLATFORM_ICONS[s.name?.toLowerCase()] || "🔗"} {s.name}
                    </span>
                    <span className="bpp__socialUrl">{s.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Если нет отдельного списка соцсетей — показываем platform_url */}
          {socials.length === 0 && data.platform_url && (
            <div className="bpp__section">
              <h3 className="bpp__sectionTitle">Соцсети</h3>
              <a className="bpp__socialLink" href={data.platform_url} target="_blank" rel="noreferrer">
                <span className="bpp__socialPlatform">{platformIcon} {data.platform}</span>
                <span className="bpp__socialUrl">{data.platform_url}</span>
              </a>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}