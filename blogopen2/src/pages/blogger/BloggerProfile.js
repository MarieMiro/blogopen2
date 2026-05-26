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

const TOPIC_OPTIONS = ["Красота", "Lifestyle", "Еда", "Путешествия", "Образование", "Одежда"];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "telegram", label: "Telegram" },
  { value: "vk", label: "VK" },
];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

const VERIFICATION_LABEL = {
  approved: { icon: "✔", text: "Верифицирован", color: "#1d9e75", bg: "rgba(29,158,117,0.10)" },
  pending:  { icon: "⏳", text: "На проверке",   color: "#ba7517", bg: "rgba(186,117,23,0.10)" },
  rejected: { icon: "✕", text: "Не одобрен",     color: "#c0392b", bg: "rgba(192,57,43,0.10)" },
};

export default function BloggerProfile() {
  const initial = useMemo(() => ({
    nick: "",
    city: "",
    gender: "",
    avatarUrl: "",
    avatarFile: null,
    followers: "",
    formats: "",
    socials: [{ platform: "telegram", url: "" }],
    topics: [],
    email: "",
    inn: "",
    verificationStatus: "pending",
  }), []);

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileRef = useRef(null);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (form.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(form.avatarUrl);

    if (!ALLOWED_TYPES.includes(file.type)) { setError("Разрешены только JPEG, PNG, WebP, GIF"); return; }
    if (file.size > MAX_SIZE) { setError("Файл слишком большой (максимум 5 МБ)"); return; }

    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, avatarUrl: url, avatarFile: file }));
  };

  // Очистка blob при размонтировании
  useEffect(() => {
    return () => {
      if (form.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(form.avatarUrl);
    };
  }, []); // eslint-disable-line

  const toggleTopic = (label) => {
    setForm((p) => {
      const has = p.topics.includes(label);
      return { ...p, topics: has ? p.topics.filter((t) => t !== label) : [...p.topics, label] };
    });
  };

  const addSocial = () => setForm((p) => ({ ...p, socials: [...p.socials, { platform: "telegram", url: "" }] }));
  const removeSocial = (idx) => setForm((p) => ({ ...p, socials: p.socials.filter((_, i) => i !== idx) }));
  const updateSocial = (idx, patch) => setForm((p) => ({
    ...p, socials: p.socials.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
  }));

  const primarySocial = form.socials?.[0] || { platform: "telegram", url: "" };

  // LOAD
  useEffect(() => {
    let alive = true;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/blogger/profile/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(data.error || "Не удалось загрузить профиль"); return; }
        if (!alive) return;

        let topics = [];
        if (Array.isArray(data.topics)) {
          topics = data.topics;
        } else {
          const t = String(data.topic || "").trim();
          topics = t ? t.split(",").map((x) => x.trim()).filter(Boolean) : [];
        }

        setForm((p) => ({
          ...p,
          nick: data.nickname || "",
          city: data.city || "",
          gender: data.gender || "",
          followers: data.followers ?? "",
          formats: data.formats || "",
          socials: [{ platform: data.platform || "telegram", url: data.platform_url || "" }],
          topics,
          email: data.email || "",
          inn: data.inn || "",
          avatarUrl: toAbsUrl(data.avatar_url || ""),
          avatarFile: null,
          // FIX: теперь verificationStatus реально заполняется
          verificationStatus: data.verification_status || "pending",
        }));
      } catch {
        if (alive) setError("Ошибка соединения с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // SAVE
  const onSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const inn = form.inn.replace(/\D/g, "");
    if (inn && inn.length !== 10 && inn.length !== 12) {
      setError("ИНН должен содержать 10 или 12 цифр");
      return;
    }

    // Ссылка на соцсеть — необязательна, но если заполнена — должна быть валидной
    const urlVal = primarySocial.url.trim();
    if (urlVal && !/^https?:\/\/.+\..+/.test(urlVal)) {
      setError("Ссылка на соцсеть должна начинаться с http:// или https://");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("nickname", form.nick);
      fd.append("followers", form.followers);
      fd.append("formats", form.formats);
      fd.append("inn", inn);
      fd.append("platform", primarySocial.platform);
      fd.append("platform_url", urlVal);
      fd.append("topic", (form.topics || []).join(", "));
      fd.append("topics", JSON.stringify(form.topics || []));
      fd.append("city", form.city);
      fd.append("gender", form.gender);
      if (form.avatarFile) fd.append("avatar", form.avatarFile);

      const res = await fetch(`${API_BASE}/api/blogger/profile/update/`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Ошибка сохранения"); return; }

      setForm((p) => ({
        ...p,
        avatarUrl: data.avatar_url ? toAbsUrl(data.avatar_url) : p.avatarUrl,
        avatarFile: null,
      }));

      setSuccess("Профиль сохранён");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Не удалось сохранить (ошибка соединения)");
    } finally {
      setSaving(false);
    }
  };

  const vBadge = VERIFICATION_LABEL[form.verificationStatus] || VERIFICATION_LABEL.pending;

  if (loading) return <div className="muted" style={{ padding: 24 }}>Загрузка профиля...</div>;

  return (
    <form className="bp" onSubmit={onSave}>

      {/* Уведомления */}
      {error && (
        <div className="bp__alert bp__alert--error">
          <span>⚠ {error}</span>
        </div>
      )}
      {success && (
        <div className="bp__alert bp__alert--success">
          <span>✓ {success}</span>
        </div>
      )}

      <section className="card bp__card">

        {/* LEFT */}
        <div className="bp__photoCol">
          <div className="bp__avatarWrap">
            {form.avatarUrl ? (
              <img className="bp__avatar" src={form.avatarUrl} alt="Аватар" />
            ) : (
              <div className="bp__avatar bp__avatar--empty">
                <span>Фото</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} style={{ display: "none" }} />
            <button className="btn bp__btn" type="button" onClick={onPickAvatar} disabled={saving}>
              Загрузить фото
            </button>
          </div>

          {/* Превью под фото */}
          <div className="bp__sideSummary">
            <h2 className="bp__sideName">{form.nick?.trim() || "Ник"}</h2>

            <div className="bp__sideChips">
              {form.city?.trim() && <span className="chip">{form.city.trim()}</span>}
              {String(form.followers).trim()
                ? <span className="chip">{Number(form.followers).toLocaleString("ru-RU")} подп.</span>
                : null
              }
            </div>

            {/* FIX: бейдж верификации теперь реально работает */}
            <div
              className="bp__verBadge"
              style={{ background: vBadge.bg, color: vBadge.color }}
            >
              {vBadge.icon} {vBadge.text}
            </div>

            {form.topics.length > 0 && (
              <div className="bp__sideTopics">
                {form.topics.map((t) => (
                  <span key={t} className="bp__sideChip">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="bp__infoCol">

          {/* Блок 1 — Личная информация */}
          <div className="bp__section">
            <h3 className="bp__h3">Личная информация</h3>
            <div className="bp__grid2">
              <label className="field">
                <span className="field__label">Ник</span>
                <input className="field__input" value={form.nick} onChange={(e) => setField("nick", e.target.value)} placeholder="@nickname" disabled={saving} />
              </label>

              <label className="field">
                <span className="field__label">Город</span>
                <input className="field__input" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Москва" disabled={saving} />
              </label>

              <label className="field">
                <span className="field__label">Пол</span>
                <select className="field__input" value={form.gender} onChange={(e) => setField("gender", e.target.value)} disabled={saving}>
                  <option value="">—</option>
                  <option value="female">Женский</option>
                  <option value="male">Мужской</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">Подписчики</span>
                <input
                  className="field__input"
                  type="number"
                  min="0"
                  value={form.followers}
                  onChange={(e) => setField("followers", e.target.value.replace(/\D/g, ""))}
                  placeholder="120000"
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          {/* Блок 2 — Соцсети */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Соцсети</h3>
              <button type="button" className="bp__addBtn" onClick={addSocial} disabled={saving}>+ добавить</button>
            </div>
            {form.socials.map((s, idx) => (
              <div className="bp__socialRow" key={idx}>
                <select className="field__input" value={s.platform} onChange={(e) => updateSocial(idx, { platform: e.target.value })} disabled={saving}>
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  className="field__input"
                  value={s.url}
                  onChange={(e) => updateSocial(idx, { url: e.target.value })}
                  placeholder="https://t.me/username"
                  disabled={saving}
                />
                {form.socials.length > 1 && (
                  <button type="button" className="bp__removeBtn" onClick={() => removeSocial(idx)} disabled={saving} aria-label="Удалить">✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Блок 3 — Тематика */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Тематика блога</h3>
              <span className="muted small">Можно выбрать несколько</span>
            </div>
            <div className="bp__topics">
              {TOPIC_OPTIONS.map((t) => {
                const checked = form.topics.includes(t);
                return (
                  <label key={t} className={`bp__topic ${checked ? "isChecked" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTopic(t)} disabled={saving} />
                    <span>{t}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Блок 4 — Форматы */}
          <div className="bp__section">
            <label className="field field--full">
              <span className="field__label">Форматы работы</span>
              <input
                className="field__input"
                value={form.formats}
                onChange={(e) => setField("formats", e.target.value)}
                placeholder="stories, reels, интеграции, обзор…"
                disabled={saving}
              />
            </label>
          </div>

          <div className="bp__divider" />

          {/* Блок 5 — Для платформы */}
          <div className="bp__section">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Для платформы</h3>
              <span className="muted small">Не показывается брендам</span>
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