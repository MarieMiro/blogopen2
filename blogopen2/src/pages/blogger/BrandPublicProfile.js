import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./brandPublicProfile.css";
import { API_BASE } from "../../api";

const VERIFICATION_LABEL = {
  approved: { icon: "✔", text: "Верифицирован", color: "#1d9e75", bg: "rgba(29,158,117,0.90)" },
};

export default function BrandPublicProfile() {
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
        const res = await fetch(`${API_BASE}/api/brands/${id}/`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(json.error || "Не удалось загрузить бренд"); return; }
        if (alive) setData(json);
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const onWrite = async () => {
    try {
      setOpeningChat(true);
      const res = await fetch(`${API_BASE}/api/chat/with/${id}/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || "Не удалось открыть чат"); return; }
      navigate("/dashboard/blogger/messages", { state: { convId: json.conversation_id } });
    } catch {
      alert("Ошибка соединения с сервером");
    } finally {
      setOpeningChat(false);
    }
  };

  const avatarSrc = data?.avatar_url
    ? (data.avatar_url.startsWith("http") ? data.avatar_url : `${API_BASE}${data.avatar_url}`)
    : "";

  const topics = Array.isArray(data?.topics) && data.topics.length ? data.topics : [];

  if (loading) return <div className="muted" style={{ padding: 24 }}>Загрузка…</div>;

  if (error) {
    return (
      <div className="brpp">
        <button className="brpp__back" onClick={() => navigate(-1)}>← Назад</button>
        <div className="brpp__error">{error}</div>
      </div>
    );
  }

  return (
    <div className="brpp">
      <button className="brpp__back" onClick={() => navigate(-1)}>← Назад</button>

      <div className="brpp__card">

        {/* LEFT */}
        <aside className="brpp__left">
          <div className="brpp__photoWrap">
            {avatarSrc ? (
              <img className="brpp__photo" src={avatarSrc} alt={data.brand_name || "Brand"} />
            ) : (
              <div className="brpp__photoEmpty">
                <span>🏢</span>
              </div>
            )}
            {data.verification_status === "approved" && (
              <div className="brpp__verBadge">✔ Верифицирован</div>
            )}
          </div>

          <div className="brpp__leftInfo">
            <h1 className="brpp__name">{data.brand_name || "Без названия"}</h1>
            {data.city && <p className="brpp__city muted">📍 {data.city}</p>}
          </div>

          {topics.length > 0 && (
            <div className="brpp__topics">
              {topics.map((t) => (
                <span key={t} className="brpp__topicChip">{t}</span>
              ))}
            </div>
          )}

          <button className="brpp__btn" type="button" onClick={onWrite} disabled={openingChat}>
            {openingChat ? "Открываю…" : "✉ Написать"}
          </button>
        </aside>

        {/* RIGHT */}
        <section className="brpp__body">

          {/* Статы */}
          <div className="brpp__stats">
            {data.budget && (
              <div className="brpp__stat">
                <span className="brpp__statIcon">💰</span>
                <div>
                  <div className="brpp__statVal">{data.budget}</div>
                  <div className="brpp__statLabel">Бюджет на интеграцию</div>
                </div>
              </div>
            )}
            {data.city && (
              <div className="brpp__stat">
                <span className="brpp__statIcon">📍</span>
                <div>
                  <div className="brpp__statVal">{data.city}</div>
                  <div className="brpp__statLabel">Город</div>
                </div>
              </div>
            )}
            {data.sphere && (
              <div className="brpp__stat">
                <span className="brpp__statIcon">🏷</span>
                <div>
                  <div className="brpp__statVal">{data.sphere}</div>
                  <div className="brpp__statLabel">Сфера</div>
                </div>
              </div>
            )}
          </div>

          {/* Описание */}
          {data.about && (
            <div className="brpp__section">
              <p className="brpp__sectionTitle">О компании</p>
              <p className="brpp__about">{data.about}</p>
            </div>
          )}

          {/* Контакт */}
          {data.contact_person && (
            <div className="brpp__section">
              <p className="brpp__sectionTitle">Контактное лицо</p>
              <div className="brpp__contact">
                <span className="brpp__contactIcon">👤</span>
                <span className="brpp__contactName">{data.contact_person}</span>
              </div>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}