import React, { useEffect, useMemo, useRef, useState } from "react";
import "./bloggerProfile.css";
import { API_BASE } from "../../api";

const toAbsUrl = (u) => {
  if (!u) return "";
  if (u.startsWith("blob:")) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return `${API_BASE}/${u}`;
};

const TOPIC_OPTIONS = [
  "Красота",
  "Lifestyle",
  "Еда",
  "Путешествия",
  "Образование",
  "Одежда",
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "telegram", label: "Telegram" },
  { value: "vk", label: "VK" },
];

export default function BloggerProfile() {
  const initial = useMemo(
    () => ({
      nick: "",
      city: "",
      gender: "", // "female" | "male" | ""

      avatarUrl: "",
      avatarFile: null,

      followers: "",
      formats: "",

      // соцсети (можно несколько)
      socials: [{ platform: "telegram", url: "" }],

      // тематики (чекбоксы)
      topics: [],

      email: "",
      inn: "",

      progress: 0,
    }),
    []
  );

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, avatarUrl: url, avatarFile: file }));
  };

  const toggleTopic = (label) => {
    setForm((p) => {
      const has = p.topics.includes(label);
      return {
        ...p,
        topics: has ? p.topics.filter((t) => t !== label) : [...p.topics, label],
      };
    });
  };

  const addSocial = () => {
    setForm((p) => ({
      ...p,
      socials: [...p.socials, { platform: "telegram", url: "" }],
    }));
  };

  const removeSocial = (idx) => {
    setForm((p) => ({
      ...p,
      socials: p.socials.filter((_, i) => i !== idx),
    }));
  };

  const updateSocial = (idx, patch) => {
    setForm((p) => ({
      ...p,
      socials: p.socials.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const primarySocial = form.socials?.[0] || { platform: "telegram", url: "" };

  // загрузка профиля
  useEffect(() => {
    let alive = true;

    (async () => {
      setError("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/blogger/profile/`, {
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить профиль");
          return;
        }
        if (!alive) return;

        const loadedTopic = (data.topic || "").trim();
        const topicsArr =
          loadedTopic && loadedTopic.includes(",")
            ? loadedTopic.split(",").map((x) => x.trim()).filter(Boolean)
            : loadedTopic
              ? [loadedTopic]
              : [];

        const loadedPlatform = data.platform || "telegram";
        const loadedUrl = data.platform_url || "";

        setForm((p) => ({
          ...p,
          nick: data.nickname || "",
          city: data.city || "",       // если бэк пока не отдает — останется ""
          gender: data.gender || "",   // если бэк пока не отдает — останется ""

          followers: data.followers ?? "",
          formats: data.formats || "",

          socials: [{ platform: loadedPlatform, url: loadedUrl }],
          topics: topicsArr,

          email: data.email || "",
          inn: data.inn || "",

          avatarUrl: toAbsUrl(data.avatar_url || ""),
          avatarFile: null,

          progress: data.progress ?? 0,
        }));
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
} finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // сохранение профиля
  const onSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const fd = new FormData();

      fd.append("nickname", form.nick);
      fd.append("followers", form.followers);
      fd.append("formats", form.formats);
      fd.append("inn", form.inn);

      // 👇 совместимость с текущим бэком:
      fd.append("platform", primarySocial.platform);
      fd.append("platform_url", primarySocial.url);

      // тематики чекбоксами -> строка
      fd.append("topic", form.topics.join(", "));

      // можно отправить и это — если бэк игнорирует, ничего страшного
      fd.append("city", form.city);
      fd.append("gender", form.gender);

      if (form.avatarFile) fd.append("avatar", form.avatarFile);

      const res = await fetch(`${API_BASE}/api/blogger/profile/update/`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }

      setForm((p) => ({
        ...p,
        avatarUrl: data.avatar_url ? toAbsUrl(data.avatar_url) : p.avatarUrl,
        avatarFile: null,
        progress: data.progress ?? p.progress,
      }));

      alert("Сохранено!");
    } catch {
      setError("Не удалось сохранить (ошибка соединения)");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="muted">Загрузка профиля...</div>;

  return (
    <form className="bp" onSubmit={onSave}>
      {error && (
        <div className="card bp__error" style={{ borderColor: "rgba(220,20,60,.35)" }}>
          <p className="small" style={{ color: "crimson", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      <section className="card bp__card">
        {/* LEFT: photo */}
        
  <div className="bp__photoCol">
    <div className="bp__avatarWrap">
      {form.avatarUrl ? (
        <img className="bp__avatar" src={form.avatarUrl} alt="Аватар" />
      ) : (
        <div className="bp__avatar bp__avatar--empty">
          <span>Фото</span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onAvatarChange}
        style={{ display: "none" }}
      />

      <button
        className="btn bp__btn"
        type="button"
        onClick={onPickAvatar}
        disabled={saving}
      >
        Загрузить фото
      </button>
    </div>

    {/* ✅ ВОТ ЭТО ДОБАВЬ: ник/город/подписчики под фото */}
    <div className="bp__sideSummary">
      <h2 className="bp__sideName">{form.nick?.trim() || "Ник"}</h2>

      <div className="bp__sideChips">
        <span className="chip">{form.city?.trim() || "Город"}</span>
        <span className="chip">
          {String(form.followers).trim()
            ? `${form.followers} подписчиков`
            : "Подписчики"}
        </span>
      </div>
    </div>
  </div>

        {/* RIGHT: info */}
        <div className="bp__infoCol">
          
          <h3 className="bp__h3">Личная информация</h3>
          <div className="bp__grid2">
            <label className="field">
              <span className="field__label">Ник</span>
              <input
                className="field__input"
                value={form.nick}
                onChange={(e) => setField("nick", e.target.value)}
                placeholder="@nickname"
                disabled={saving}
              />
            </label>

            <label className="field">
              <span className="field__label">Город</span>
              <input
                className="field__input"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Москва"
                disabled={saving}
              />
            </label>

            <label className="field">
              <span className="field__label">Пол</span>
              <select
                className="field__input"
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
                disabled={saving}
              >
                <option value="">—</option>
                <option value="female">Женский</option>
                <option value="male">Мужской</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Подписчики</span>
              <input
                className="field__input"
                value={form.followers}
                onChange={(e) => setField("followers", e.target.value)}
                placeholder="например 120000"
                disabled={saving}
              />
            </label>
          </div>

          {/* socials */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Соцсети</h3>
              <button type="button" className="bp__addBtn" onClick={addSocial} disabled={saving}>
                + добавить
              </button>
            </div>

            <div className="bp__socials">
              {form.socials.map((s, idx) => (
                <div className="bp__socialRow" key={idx}>
                  <select
                    className="field__input"
                    value={s.platform}
                    onChange={(e) => updateSocial(idx, { platform: e.target.value })}
                    disabled={saving}
                  >
                    {PLATFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <input
                    className="field__input"
                    value={s.url}
                    onChange={(e) => updateSocial(idx, { url: e.target.value })}
                    placeholder="Ссылка на профиль"
                    disabled={saving}
                  />

                  {form.socials.length > 1 && (
                    <button
                      type="button"
                      className="bp__removeBtn"
                      onClick={() => removeSocial(idx)}
                      disabled={saving}
                      aria-label="Удалить соцсеть"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {!!primarySocial?.url?.trim() && (
                <a className="bp__link" href={primarySocial.url} target="_blank" rel="noreferrer">
                  Открыть профиль
                </a>
              )}
              <div className="muted small">
              
              </div>
            </div>
          </div>

          {/* topics */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Тематика блога</h3>
              <div className="muted small">Можно выбрать несколько</div>
            </div>

            <div className="bp__topics">
              {TOPIC_OPTIONS.map((t) => {
                const checked = form.topics.includes(t);
                return (
                  <label key={t} className={`bp__topic ${checked ? "isChecked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTopic(t)}
                      disabled={saving}
                    />
                    <span>{t}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* formats + platform data */}
          <div className="bp__grid2">
            <label className="field field--full">
              <span className="field__label">Форматы</span>
              <input
                className="field__input"
                value={form.formats}
                onChange={(e) => setField("formats", e.target.value)}
                placeholder="stories, reels, интеграции, обзор…"
                disabled={saving}
              />
            </label>
          </div>

          

          {/* platform-only */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <div className="bp__divider"/>
              <h3 className="bp__h3">Для платформы</h3>
              <div className="muted small">Не показывается брендам</div>
            </div>

            <div className="bp__grid2">
              <label className="field">
                <span className="field__label">Email</span>
                <input className="field__input" value={form.email} disabled />
              </label>

              <label className="field">
                <span className="field__label">ИНН</span>
                <input
                  className="field__input"
                  value={form.inn}
                  onChange={(e) => setField("inn", e.target.value)}
                  placeholder="10 или 12 цифр"
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="bp__actions">
            <button className="btn btnPrimary" type="submit" disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}