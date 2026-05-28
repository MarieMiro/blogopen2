import React, { useEffect, useMemo, useRef, useState } from "react";
import "./brandProfile.css";
import { API_BASE } from "../../api";

const toAbsUrl = (u) => {
  if (!u) return "";
  if (u.startsWith("blob:")) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return `${API_BASE}/${u}`;
};

const TOPIC_OPTIONS = ["Красота", "Lifestyle", "Еда", "Путешествия", "Образование", "Одежда"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

const VERIFICATION_LABEL = {
  approved: { icon: "✔", text: "Верифицирован", color: "#1d9e75", bg: "rgba(29,158,117,0.10)" },
  pending:  { icon: "⏳", text: "На проверке",   color: "#ba7517", bg: "rgba(186,117,23,0.10)" },
  rejected: { icon: "✕", text: "Не одобрен",     color: "#c0392b", bg: "rgba(192,57,43,0.10)" },
};

export default function BrandProfile() {
  const initial = useMemo(() => ({
    marketplaceUrl: "",
    productAnalysis: null,
    analyzing: false,
    brandName: "",
    city: "",
    about: "",
    budget: "",
    email: "",
    inn: "",
    contactPerson: "",
    topics: [],
    avatarUrl: "",
    avatarFile: null,
    verificationStatus: "pending",
  }), []);

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileRef = useRef(null);
  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const toggleTopic = (label) => {
    setForm((p) => {
      const has = p.topics.includes(label);
      return { ...p, topics: has ? p.topics.filter((t) => t !== label) : [...p.topics, label] };
    });
  };

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

  // LOAD
  useEffect(() => {
    let alive = true;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/brand/profile/`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { if (alive) setError(data.error || "Не удалось загрузить профиль"); return; }
        if (!alive) return;

        let topicsArr = [];
        if (Array.isArray(data.topics)) {
          topicsArr = data.topics.filter(Boolean);
        } else {
          const s = String(data.sphere || "").trim();
          if (s) topicsArr = s.split(",").map((x) => x.trim()).filter(Boolean);
        }

        setForm((p) => ({
          ...p,
          brandName: data.brand_name || "",
          city: data.city || "",
          about: data.about || "",
          budget: data.budget || "",
          email: data.email || "",
          inn: data.inn || "",
          contactPerson: data.contact_person || "",
          topics: Array.isArray(data.topics) ? data.topics : topicsArr,
          avatarUrl: toAbsUrl(data.avatar_url || ""),
          avatarFile: null,
          marketplaceUrl: data.marketplace_url || "",
          productAnalysis: null,
          analyzing: false,
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

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("brand_name", form.brandName);
      fd.append("city", form.city);
      fd.append("about", form.about);
      fd.append("budget", form.budget);
      fd.append("inn", inn);
      fd.append("contact_person", form.contactPerson);
      fd.append("marketplace_url", form.marketplaceUrl || "");
      fd.append("sphere", form.topics.join(", "));
      fd.append("topics", JSON.stringify(form.topics));
      if (form.avatarFile) fd.append("avatar", form.avatarFile);

      const res = await fetch(`${API_BASE}/api/brand/profile/update/`, {
        method: "POST", credentials: "include", body: fd,
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

  // ANALYZE
  const onAnalyzeMarketplace = async () => {
    if (!form.marketplaceUrl?.trim()) { setError("Добавьте ссылку на профиль магазина"); return; }
    setError("");
    setSuccess("");
    setForm((p) => ({ ...p, analyzing: true, productAnalysis: null }));

    try {
      const res = await fetch(`${API_BASE}/api/product/analyze/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.marketplaceUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) { setError(data.error || "Не удалось проанализировать ссылку"); return; }

      const parsed = data.data || data.product || {};
      const TOPIC_MAP = {
        beauty: "Красота", clothes: "Одежда", food: "Еда",
        education: "Образование", home: "Lifestyle", sport: "Lifestyle",
        kids: "Lifestyle", services: "Lifestyle",
      };
      const uniqueTopics = [...new Set(
        (parsed.topics || []).map((t) => TOPIC_MAP[t]).filter((t) => t && TOPIC_OPTIONS.includes(t))
      )];

      setForm((p) => ({
        ...p,
        brandName: parsed.brand_name || p.brandName,
        about: parsed.description || p.about,
        topics: uniqueTopics.length ? uniqueTopics : p.topics,
        productAnalysis: parsed,
        analyzing: false,
      }));
      setSuccess(`Данные загружены. Проверьте и сохраните профиль.`);
    } catch {
      setError("Ошибка соединения с сервером");
      setForm((p) => ({ ...p, analyzing: false }));
    }
  };

  const vBadge = VERIFICATION_LABEL[form.verificationStatus] || VERIFICATION_LABEL.pending;

  if (loading) return <div className="muted" style={{ padding: 24 }}>Загрузка профиля...</div>;

  return (
    <form className="bp" onSubmit={onSave}>

      {error && <div className="bp__alert bp__alert--error">⚠ {error}</div>}
      {success && <div className="bp__alert bp__alert--success">✓ {success}</div>}

      <section className="card bp__card">

        {/* LEFT */}
        <div className="bp__photoCol">
          <div className="bp__avatarWrap">
            {form.avatarUrl ? (
              <img className="bp__avatar" src={form.avatarUrl} alt="Аватар" />
            ) : (
              <div className="bp__avatar bp__avatar--empty">Фото</div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} style={{ display: "none" }} />
            <button className="btn bp__btn" type="button" onClick={onPickAvatar} disabled={saving}>
              Загрузить фото
            </button>
          </div>

          <div className="bp__sideSummary">
            <h2 className="bp__sideName">{form.brandName || "Название бренда"}</h2>

            <div className="bp__sideChips">
              {form.city && <span className="chip">{form.city}</span>}
              {form.budget && <span className="chip">💰 {form.budget}</span>}
            </div>

            {/* Бейдж верификации */}
            <div className="bp__verBadge" style={{ background: vBadge.bg, color: vBadge.color }}>
              {vBadge.icon} {vBadge.text}
            </div>

            {form.topics.length > 0 && (
              <div className="bp__sideTopics">
                {form.topics.map((t) => (
                  <span key={t} className="bp__sideChip">{t}</span>
                ))}
              </div>
            )}

            {form.about && (
              <p className="bp__sideAbout muted">{form.about}</p>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="bp__infoCol">

          {/* Блок 1 — Маркетплейс */}
          <div className="bp__block">
            <h3 className="bp__h3">Информация для блогера</h3>

            <div className="bp__marketplaceBlock">
              <label className="field field--full">
                <span className="field__label">Ссылка на магазин маркетплейса</span>
                <input
                  className="field__input"
                  type="url"
                  placeholder="https://www.ozon.ru/brand/..."
                  value={form.marketplaceUrl || ""}
                  onChange={(e) => setField("marketplaceUrl", e.target.value)}
                  disabled={saving || form.analyzing}
                />
              </label>

              <div className="bp__marketplaceActions">
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={onAnalyzeMarketplace}
                  disabled={saving || form.analyzing || !form.marketplaceUrl?.trim()}
                >
                  {form.analyzing ? "Анализ..." : "Анализировать"}
                </button>
              </div>

              <p className="bp__hint muted">
                Платформа автоматически заполнит тематику и описание по ссылке на ваш магазин.
              </p>

              {form.productAnalysis && (
                <div className="bp__analysis card">
                  <h4 className="bp__analysisTitle">Результат анализа</h4>
                  <div className="bp__analysisGrid">
                    <div>
                      <span className="bp__analysisLabel">Маркетплейс</span>
                      <div>{form.productAnalysis.marketplace || "—"}</div>
                    </div>
                    <div>
                      <span className="bp__analysisLabel">Категория</span>
                      <div>{form.productAnalysis.category || "—"}</div>
                    </div>
                    <div className="bp__analysisFull">
                      <span className="bp__analysisLabel">Название</span>
                      <div>{form.productAnalysis.title || "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bp__divider" />

          {/* Блок 2 — Основная информация */}
          <div className="bp__block">
            <h3 className="bp__h3">Основная информация</h3>
            <div className="bp__grid2">
              <label className="field">
                <span className="field__label">Название бренда</span>
                <input className="field__input" value={form.brandName} onChange={(e) => setField("brandName", e.target.value)} disabled={saving} />
              </label>
              <label className="field">
                <span className="field__label">Город</span>
                <input className="field__input" value={form.city} onChange={(e) => setField("city", e.target.value)} disabled={saving} />
              </label>
              <label className="field">
                <span className="field__label">Бюджет на интеграцию</span>
                <input className="field__input" placeholder="например: 50 000 ₽" value={form.budget} onChange={(e) => setField("budget", e.target.value)} disabled={saving} />
              </label>
              <label className="field field--full">
                <span className="field__label">Описание компании</span>
                <textarea className="field__input field__textarea" value={form.about} onChange={(e) => setField("about", e.target.value)} disabled={saving} />
              </label>
            </div>
          </div>

          <div className="bp__divider" />

          {/* Блок 3 — Тематика */}
          <div className="bp__block">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Тематика бренда</h3>
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

          <div className="bp__divider" />

          {/* Блок 4 — Для платформы */}
          <div className="bp__block">
            <div className="bp__sectionHead">
              <h3 className="bp__h3">Для платформы</h3>
              <span className="muted small">Не показывается блогерам</span>
            </div>
            <div className="bp__grid2">
              <label className="field">
                <span className="field__label">Email</span>
                <input className="field__input" value={form.email} disabled />
              </label>
              <label className="field">
                <span className="field__label">ИНН</span>
                <input className="field__input" value={form.inn} onChange={(e) => setField("inn", e.target.value)} placeholder="10 или 12 цифр" disabled={saving} />
              </label>
              <label className="field field--full">
                <span className="field__label">Контактное лицо</span>
                <input className="field__input" value={form.contactPerson} onChange={(e) => setField("contactPerson", e.target.value)} disabled={saving} />
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