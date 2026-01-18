import React, { useEffect, useMemo, useRef, useState } from "react";
import "./brandProfile.css";

import { API_BASE } from "../../api";

export default function BrandProfile() {
  const initial = useMemo(
    () => ({
      brandName: "",
      city: "",
      sphere: "",
      about: "",
      budget: "",
      email: "",
      inn: "",
      contactPerson: "",
      avatarUrl: "",
      avatarFile: null,
    }),
    []
  );

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);

  const setField = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, avatarUrl: url, avatarFile: file }));
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      setError("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/brand/profile/`, {
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
          brandName: data.brand_name || "",
          city: data.city || "",
          sphere: data.sphere || "",
          about: data.about || "",
          budget: data.budget || "",
          email: data.email || "",
          inn: data.inn || "",
          contactPerson: data.contact_person || "",
          avatarUrl: data.avatar_url || "",
          avatarFile: null,
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

  const onSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append("brand_name", form.brandName);
      fd.append("city", form.city);
      fd.append("sphere", form.sphere);
      fd.append("about", form.about);
      fd.append("budget", form.budget);
      fd.append("inn", form.inn);
      fd.append("contact_person", form.contactPerson);

      if (form.avatarFile) fd.append("avatar", form.avatarFile);

      const res = await fetch(`${API_BASE}/api/brand/profile/update/`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }

      if (data.avatar_url) {
        setForm((p) => ({ ...p, avatarUrl: data.avatar_url, avatarFile: null }));
      } else {
        setForm((p) => ({ ...p, avatarFile: null }));
      }

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

          <button className="btn bp__btn" type="button" onClick={onPickAvatar} disabled={saving}>
            Загрузить фото
          </button>
        </div>

        <div className="bp__public"><h2 className="bp__title">{form.brandName?.trim() || "Название бренда"}</h2>

          <div className="bp__chips">
            <span className="chip">{form.city?.trim() || "Город"}</span>
            <span className="chip">{form.sphere?.trim() || "Сфера"}</span>
          </div>

          <p className="bp__about muted">
            {form.about?.trim() || "Короткое описание компании — это увидят блогеры в каталоге/профиле."}
          </p>
        </div>
      </section>

      <section className="bp__right">
        {error && (
          <div className="card" style={{ borderColor: "rgba(220,20,60,.35)" }}>
            <p className="small" style={{ color: "crimson", margin: 0 }}>{error}</p>
          </div>
        )}

        <div className="card bp__block">
          <div className="bp__blockHead">
            <h3>Информация для блогера</h3>
            <p className="muted small">Это будет видно блогерам в твоём профиле.</p>
          </div>

          <div className="bp__grid">
            <label className="field">
              <span className="field__label">Название бренда</span>
              <input className="field__input" value={form.brandName}
                     onChange={(e) => setField("brandName", e.target.value)}
                     disabled={saving} />
            </label>

            <label className="field">
              <span className="field__label">Город</span>
              <input className="field__input" value={form.city}
                     onChange={(e) => setField("city", e.target.value)}
                     disabled={saving} />
            </label>

            <label className="field">
              <span className="field__label">Сфера</span>
              <input className="field__input" value={form.sphere}
                     onChange={(e) => setField("sphere", e.target.value)}
                     disabled={saving} />
            </label>

            <label className="field field--full">
              <span className="field__label">Описание компании</span>
              <textarea className="field__input field__textarea" rows={5}
                        value={form.about}
                        onChange={(e) => setField("about", e.target.value)}
                        disabled={saving} />
            </label>

            <label className="field">
              <span className="field__label">Бюджет</span>
              <input className="field__input" value={form.budget}
                     onChange={(e) => setField("budget", e.target.value)}
                     disabled={saving} />
            </label>
          </div>
        </div>

        <div className="card bp__block">
          <div className="bp__blockHead">
            <h3>Личная информация (для платформы)</h3>
            <p className="muted small">Эти данные не показываются другим пользователям.</p>
          </div>

          <div className="bp__grid">
            <label className="field">
              <span className="field__label">Email</span>
              <input className="field__input" value={form.email} disabled />
            </label>

            <label className="field">
              <span className="field__label">ИНН</span>
              <input className="field__input" value={form.inn}
                     onChange={(e) => setField("inn", e.target.value)}
                     disabled={saving} />
            </label>

            <label className="field field--full">
              <span className="field__label">Контактное лицо</span>
              <input className="field__input" value={form.contactPerson}
                     onChange={(e) => setField("contactPerson", e.target.value)}
                     disabled={saving} />
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