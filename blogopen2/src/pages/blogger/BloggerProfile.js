import React, { useEffect, useMemo, useRef, useState } from "react";
import "./bloggerProfile.css";
import { API_BASE } from "../../api";

export default function BloggerProfile() {
  const initial = useMemo(
    () => ({
      nick: "",
      avatarUrl: "",
      avatarFile: null,

      platform: "telegram",
      platformUrl: "",
      followers: "",
      topic: "",
      formats: "",

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
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, avatarUrl: url, avatarFile: file }));
  };

  
  const localProgress = useMemo(() => {
    const keys = ["nick", "platform", "platformUrl", "followers", "topic", "formats", "inn"];
    const filled = keys.filter((k) => String(form[k] ?? "").trim().length > 0).length;
    return Math.round((filled / keys.length) * 100);
  }, [form]);

  const progress =
    Number.isFinite(form.progress) && form.progress > 0 ? form.progress : localProgress;

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

        const data = await res.json();

        if (!res.ok) {
          if (alive) setError(data.error || "Не удалось загрузить профиль");
          return;
        }

        if (!alive) return;

        setForm((p) => ({
          ...p,
          nick: data.nickname || "",
          platform: data.platform || "telegram",
          platformUrl: data.platform_url || "",
          followers: data.followers ?? "",
          topic: data.topic || "",
          formats: data.formats || "",
          email: data.email || "",
          inn: data.inn || "",
          avatarUrl: data.avatar_url
          ? `${API_BASE}${data.avatar_url}`
          : p.avatarUrl,
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
      fd.append("platform", form.platform);
      fd.append("platform_url", form.platformUrl);
      fd.append("followers", form.followers);
      fd.append("topic", form.topic);
      fd.append("formats", form.formats);
      fd.append("inn", form.inn);

      if (form.avatarFile) fd.append("avatar", form.avatarFile);

      const res = await fetch(`${API_BASE}/api/blogger/profile/update/`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }

      setForm((p) => ({
        ...p,
        avatarUrl: data.avatar_url
        ? `${API_BASE}${data.avatar_url}`
        : p.avatarUrl,
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
      <section className="bp__left card">
        <div className="bp__avatarWrap">
          {form.avatarUrl ? (<img className="bp__avatar" src={form.avatarUrl} alt="Аватар" />
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

          <button className="btn bp__btn" type="button" onClick={onPickAvatar} disabled={saving}>
            Загрузить фото
          </button>
        </div>

        <div className="bp__public">
          <h2 className="bp__title">{form.nick?.trim() || "Ник"}</h2>

          <div className="bp__chips">
            <span className="chip">{form.platform || "Платформа"}</span>
            <span className="chip">
              {String(form.followers).trim() ? `${form.followers} подписчиков` : "Подписчики"}
            </span>
          </div>

          <p className="bp__about muted">{form.topic?.trim() || "Тематика (то, что увидят бренды)."}</p>

          {form.platformUrl?.trim() && (
            <a className="bp__link" href={form.platformUrl} target="_blank" rel="noreferrer">
              Открыть профиль
            </a>
          )}
        </div>

        <div className="bp__progress card">
          <div className="bp__progressHead">
            <strong>Профиль заполнен на {progress}%</strong>
            <span className="muted small">Заполни поля — бренды доверяют больше 🙂</span>
          </div>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="bp__right">
        {error && (
          <div className="card" style={{ borderColor: "rgba(220,20,60,.35)" }}>
            <p className="small" style={{ color: "crimson", margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        <div className="card bp__block">
          <div className="bp__blockHead">
            <h3>Публичная информация</h3>
            <p className="muted small">Это будут видеть бренды.</p>
          </div>

          <div className="bp__grid">
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
              <span className="field__label">Платформа</span>
              <select
                className="field__input"
                value={form.platform}
                onChange={(e) => setField("platform", e.target.value)}
                disabled={saving}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="telegram">Telegram</option>
                <option value="vk">VK</option>
              </select>
            </label>

            <label className="field field--full">
              <span className="field__label">Ссылка на профиль</span>
              <input
                className="field__input"
                value={form.platformUrl}
                onChange={(e) => setField("platformUrl", e.target.value)}
                placeholder="https://..."
                disabled={saving}
              />
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

            <label className="field">
              <span className="field__label">Тематика</span>
              <input
                className="field__input"
                value={form.topic}
                onChange={(e) => setField("topic", e.target.value)}
                placeholder="beauty / lifestyle / food…"
                disabled={saving}
              />
            </label>

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
        </div>

        <div className="card bp__block">
          <div className="bp__blockHead">
            <h3>Для платформы</h3>
            <p className="muted small">Не показывается брендам.</p>
          </div>

          <div className="bp__grid">
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